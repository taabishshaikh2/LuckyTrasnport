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
];
export const gstMoneyKeys = [
  "taxableValue",
  "toll",
  "totalAmount",
  "igstAmount",
  "cgstAmount",
  "sgstAmount",
];
export const billKey = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();
export function invoiceGstRow(invoice) {
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
  };
}
export function combineGstRows(invoices, imports) {
  const keys = new Set(invoices.map((i) => billKey(i.invoiceNumber)));
  return [
    ...invoices.filter((i) => i.status !== "Cancelled").map(invoiceGstRow),
    ...imports
      .filter((r) => !keys.has(billKey(r.billNumber)))
      .map((r) => ({
        ...r,
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
