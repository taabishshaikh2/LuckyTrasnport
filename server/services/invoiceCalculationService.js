import Decimal from "decimal.js";
import { money } from "./tripCalculationService.js";
import { AppError } from "../utils/errors.js";
export function calculateInvoice(base, input, companyState) {
  const interstate = input.stateCode !== companyState;
  if (interstate && (input.cgstRate || input.sgstRate))
    throw new AppError("Interstate invoice requires IGST; clear CGST and SGST");
  if (!interstate && input.igstRate)
    throw new AppError("Intrastate invoice requires CGST/SGST; clear IGST");
  if (!interstate && input.cgstRate !== input.sgstRate)
    throw new AppError("CGST and SGST rates must match");
  const d = new Decimal(base);
  const tax = (r) => money(d.mul(r || 0).div(100));
  const cgstAmount = tax(input.cgstRate),
    sgstAmount = tax(input.sgstRate),
    igstAmount = tax(input.igstRate);
  const exact = d.add(input.nonTaxableAmount || 0).add(cgstAmount).add(sgstAmount).add(igstAmount);
  const totalAmount = input.roundToRupee
    ? exact.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
    : money(exact);
  return {
    baseAmount: money(base),
    cgstRate: input.cgstRate,
    sgstRate: input.sgstRate,
    igstRate: input.igstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    roundOff: money(new Decimal(totalAmount).sub(exact)),
    totalAmount,
  };
}
const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];
function words(n) {
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + " " + words(n % 10);
  for (const [unit, label] of [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
    [100, "Hundred"],
  ])
    if (n >= unit)
      return words(Math.floor(n / unit)) + " " + label + " " + words(n % unit);
  return "";
}
export function amountInWords(amount) {
  const paise = new Decimal(amount).mul(100).toDecimalPlaces(0).toNumber();
  return (
    "Rupees " +
    (words(Math.floor(paise / 100)).trim() || "Zero") +
    (paise % 100 ? " and " + words(paise % 100).trim() + " Paise" : "") +
    " Only"
  ).replace(/\s+/g, " ");
}
export function paymentState(total, received, dueDate, now = new Date()) {
  if (received >= total) return "Paid";
  if (received > 0) return "Partially Paid";
  const indianToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
  return new Date(dueDate).toISOString().slice(0, 10) < indianToday
    ? "Overdue"
    : "Pending";
}
