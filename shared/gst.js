export const gstColumns = [
  ["SR.NO", "srNo"],
  ["CUSTOMER NAME", "customerName"],
  ["CUSTOMER GST NO", "customerGstin"],
  ["BILL DATE", "billDate"],
  ["BILL NO", "billNumber"],
  ["CENTRE AND LOCATION", "location"],
  ["TYPE OF SERVICES", "serviceDescription"],
  ["TAXABLE VALUE", "taxableValue"],
  ["TOLL", "toll"],
  ["TOTAL AMOUNT", "totalAmount"],
  ["IGST 18.00%", "igstAmount"],
  ["CGST 9.00%", "cgstAmount"],
  ["SGST 9.00%", "sgstAmount"],
  ["ROUND OFF", "roundOff"],
  ["TOTAL BILL AMOUNT", "totalBillAmount"],
  ["RECEIVE DATE", "receiveDate"],
  ["PAYMENT RECD DETAILS", "paymentDetails"],
  ["RECEIVED AMOUNT", "receivedAmount"],
  ["DIFFERENCE/ TDS", "differenceTds"],
];
export const gstMoneyKeys = [
  "taxableValue",
  "toll",
  "totalAmount",
  "igstAmount",
  "cgstAmount",
  "sgstAmount",
  "roundOff",
  "totalBillAmount",
  "receivedAmount",
  "differenceTds",
];
export const billKey = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();
export function invoiceGstRow(invoice, payments = []) {
  const ordered = [...payments].sort(
    (a, b) => new Date(a.paymentDate) - new Date(b.paymentDate),
  );
  const receivedAmount =
    Math.round(
      ordered.reduce((sum, p) => sum + Number(p.amount || 0), 0) * 100,
    ) / 100;
  const totalBillAmount = Number(
    invoice.totalAmount ??
      Number(invoice.baseAmount || 0) +
        Number(invoice.nonTaxableAmount || 0) +
        Number(invoice.igstAmount || 0) +
        Number(invoice.cgstAmount || 0) +
        Number(invoice.sgstAmount || 0) +
        Number(invoice.roundOff || 0),
  );
  const taxableValue = Number(invoice.baseAmount || 0),
    toll = Number(invoice.nonTaxableAmount || 0);
  return {
    _id: String(invoice._id),
    source: "Invoice",
    invoiceId: String(invoice._id),
    customerName: invoice.invoicedTo || invoice.customerId?.companyName || "",
    customerGstin: invoice.gstin || invoice.dhlGstin || "",
    billDate: new Date(invoice.invoiceDate).toISOString().slice(0, 10),
    billNumber: invoice.invoiceNumber,
    location: invoice.location || "",
    serviceDescription: invoice.description || "",
    taxableValue,
    toll,
    totalAmount: Math.round((taxableValue + toll) * 100) / 100,
    igstAmount: Number(invoice.igstAmount || 0),
    cgstAmount: Number(invoice.cgstAmount || 0),
    sgstAmount: Number(invoice.sgstAmount || 0),
    roundOff: Number(invoice.roundOff || 0),
    totalBillAmount,
    receiveDate: ordered.length
      ? new Date(ordered.at(-1).paymentDate).toISOString().slice(0, 10)
      : "",
    paymentDetails: ordered
      .map((p) =>
        [
          p.paymentMode,
          p.referenceNumber,
          Number(p.amount || 0).toFixed(2),
          p.notes,
        ]
          .filter(Boolean)
          .join(" - "),
      )
      .join("; "),
    receivedAmount,
    differenceTds: Math.round((totalBillAmount - receivedAmount) * 100) / 100,
  };
}
export function combineGstRows(invoices, imports, payments = []) {
  const byInvoice = new Map();
  for (const payment of payments) {
    const key = String(payment.invoiceId);
    if (!byInvoice.has(key)) byInvoice.set(key, []);
    byInvoice.get(key).push(payment);
  }
  const keys = new Set(invoices.map((i) => billKey(i.invoiceNumber)));
  return [
    ...invoices
      .filter((i) => i.status !== "Cancelled")
      .map((i) => invoiceGstRow(i, byInvoice.get(String(i._id)) || [])),
    ...imports
      .filter((r) => !keys.has(billKey(r.billNumber)))
      .map((r) => ({
        ...r,
        ...gstPaymentFields(r),
        source: "Imported",
        billDate: new Date(r.billDate).toISOString().slice(0, 10),
      })),
  ]
    .sort(
      (a, b) =>
        a.billDate.localeCompare(b.billDate) ||
        a.billNumber.localeCompare(b.billNumber),
    )
    .map((r, index) => ({ ...r, srNo: index + 1 }));
}

export function gstPaymentFields(row) {
  const roundOff = Number(row.roundOff || 0),
    totalBillAmount = Number(
      row.totalBillAmount ??
        Number(row.totalAmount || 0) +
          Number(row.igstAmount || 0) +
          Number(row.cgstAmount || 0) +
          Number(row.sgstAmount || 0) +
          roundOff,
    ),
    receivedAmount = Number(row.receivedAmount || 0);
  return {
    roundOff,
    totalBillAmount,
    receivedAmount,
    differenceTds: Math.round((totalBillAmount - receivedAmount) * 100) / 100,
    receiveDate: row.receiveDate
      ? new Date(row.receiveDate).toISOString().slice(0, 10)
      : "",
    paymentDetails: row.paymentDetails || "",
  };
}
