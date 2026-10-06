import { z } from "zod";
import { CompanyProfile, Audit } from "../models/index.js";
import { company } from "../config/env.js";
const text = z.string().trim().max(500);
const blankOr = (rule) => z.union([rule, z.literal("")]);
export const companyProfileSchema = z
  .object({
    name: text.min(1),
    address: z.string().trim().max(2000),
    phone: blankOr(
      text.regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number"),
    ),
    email: blankOr(text.email()),
    gstin: blankOr(
      text.regex(
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
        "Enter a valid GSTIN",
      ),
    ),
    pan: blankOr(text.regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN")),
    stateCode: text.regex(/^\d{2}$/, "Enter a two-digit state code"),
    bankName: text,
    bankAccount: text,
    bankIfsc: blankOr(
      text.regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC"),
    ),
    tagline: text,
    disputeClause: z.string().trim().max(10000),
    interestClause: z.string().trim().max(10000),
    paymentClause: z.string().trim().max(10000),
  })
  .strict()
  .refine(
    (v) => !v.gstin || v.gstin.slice(0, 2) === v.stateCode,
    "GSTIN must match the company state code",
  );
export async function getCompanyProfile(session) {
  const saved = await CompanyProfile.findById("company")
    .session(session || null)
    .lean();
  const defaults = company();
  return saved
    ? Object.fromEntries(
        Object.keys(defaults).map((key) => [key, saved[key] ?? defaults[key]]),
      )
    : defaults;
}
export async function saveCompanyProfile(input, user, session) {
  const previous = await getCompanyProfile(session);
  await CompanyProfile.findOneAndUpdate(
    { _id: "company" },
    { $set: { ...input, updatedBy: user._id } },
    { upsert: true, new: true, session, runValidators: true },
  );
  await Audit.create(
    [
      {
        entity: "CompanyProfile",
        previousValue: previous,
        newValue: input,
        reason: "Company profile updated",
        changedBy: user._id,
      },
    ],
    { session },
  );
  return input;
}
