import { Payment, Invoice } from "../models/index.js";
import { sequence } from "./sequenceService.js";
import { money } from "./tripCalculationService.js";
import { paymentState } from "./invoiceCalculationService.js";
import { AppError } from "../utils/errors.js";
export async function invoiceBalance(invoice, session) {
  const rows = await Payment.find({ invoiceId: invoice._id }, null, {
    session,
  }).lean();
  const received = money(rows.reduce((sum, p) => sum + p.amount, 0));
  return {
    received,
    outstanding: money(invoice.totalAmount - received),
    status:
      invoice.status === "Cancelled"
        ? "Cancelled"
        : paymentState(invoice.totalAmount, received, invoice.dueDate),
    payments: rows,
  };
}
export async function recordPayment(input, user, session) {
  const invoice = await Invoice.findById(input.invoiceId).session(session);
  if (!invoice || invoice.status === "Cancelled")
    throw new AppError("Invoice unavailable");
  const amount = money(input.amount);
  if (amount <= 0) throw new AppError("Payment must be at least 0.01");
  const balance = await invoiceBalance(invoice, session);
  if (balance.received !== invoice.receivedGuard)
    throw new AppError(
      "Payment balance needs reconciliation. Contact Admin",
      409,
    );
  if (amount > balance.outstanding)
    throw new AppError("Payment exceeds outstanding balance");
  const received = money(balance.received + amount);
  const updated = await Invoice.updateOne(
    {
      _id: invoice._id,
      receivedGuard: invoice.receivedGuard,
      status: { $ne: "Cancelled" },
    },
    {
      $set: {
        receivedGuard: received,
        status: paymentState(invoice.totalAmount, received, invoice.dueDate),
        updatedBy: user._id,
      },
    },
    { session },
  );
  if (!updated.modifiedCount)
    throw new AppError("Balance changed. Try again", 409);
  const paymentId = await sequence("payment", "PAY-", session);
  const [payment] = await Payment.create(
    [
      {
        ...input,
        amount,
        paymentId,
        customerId: invoice.customerId,
        recordedBy: user._id,
      },
    ],
    { session },
  );
  return payment;
}
