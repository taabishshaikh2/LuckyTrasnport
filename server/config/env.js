import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});
export const company = () => ({
  name: process.env.COMPANY_NAME || "Lucky Transport Services",
  address: process.env.COMPANY_ADDRESS || "",
  phone: process.env.COMPANY_PHONE || "",
  email: process.env.COMPANY_EMAIL || "",
  gstin: process.env.COMPANY_GSTIN || "",
  pan: process.env.COMPANY_PAN || "",
  stateCode: process.env.COMPANY_STATE_CODE || "27",
  bankName: process.env.COMPANY_BANK_NAME || "",
  bankAccount: process.env.COMPANY_BANK_ACCOUNT || "",
  bankIfsc: process.env.COMPANY_BANK_IFSC || "",
  tagline: process.env.COMPANY_TAGLINE || "",
  disputeClause: process.env.COMPANY_DISPUTE_CLAUSE || "",
  interestClause: process.env.COMPANY_INTEREST_CLAUSE || "",
  paymentClause: process.env.COMPANY_PAYMENT_CLAUSE || "",
});
export function validateEnv() {
  if (
    !process.env.MONGODB_URI ||
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32
  )
    throw new Error(
      "Set MONGODB_URI and a JWT_SECRET of at least 32 characters",
    );
}
