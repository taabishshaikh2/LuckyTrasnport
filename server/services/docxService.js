import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  PageOrientation,
  TextRun,
} from "docx";
const para = (text, bold = false) =>
  new Paragraph({
    children: [new TextRun({ text: String(text ?? ""), bold, size: 20 })],
    spacing: { after: 100 },
  });
const cell = (text) => new TableCell({ children: [para(text)] });
const row = (values) => new TableRow({ children: values.map(cell) });
export async function tripDocx(t) {
  const headers = [
    "SR.NO",
    "DATE",
    "VEHICLE NO",
    "CHA NAME",
    "VEHICLE TYPE",
    "OPENING TIME",
    "MRB ARRIVAL",
    "CLOSING TIME",
    "PER TRIP HRS",
    "TOTAL HRS",
    "G.T IN HRS",
    "G.T AMOUNT",
  ];
  const summary = [
    ["Trip amount", t.baseAmount],
    ["Extra overtime hours", t.overtimeHours],
    ["Overtime amount", t.overtimeAmount],
    ["Other charges", t.extraAmount],
    ["Rate", t.ratePerTrip],
    ["Deductions", t.deductionAmount],
    ["TOTAL AMT", t.totalAmount],
  ];
  const entries = t.entries.map((e, i) => [
    e.srNo || i + 1,
    new Date(e.date).toLocaleDateString("en-IN"),
    e.vehicleNo || t.vehicleNumber,
    e.chaName,
    e.vehicleType || t.vehicleType,
    e.openingTime,
    e.mrbArrivalTime,
    e.closingTime,
    e.perTripHours,
    e.totalHours,
    e.gtInHours,
    e.gtAmount,
  ]);
  return Packer.toBuffer(
    new Document({
      sections: [
        {
          properties: {
            page: {
              size: { orientation: PageOrientation.LANDSCAPE },
              margin: { top: 600, bottom: 600, left: 500, right: 500 },
            },
          },
          children: [
            para("Lucky Transport Services — " + t.tripId, true),
            para(t.pickupLocation + " → " + t.dropLocation),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: summary.map(row),
            }),
            para("Challan entries", true),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [row(headers), ...entries.map(row)],
            }),
            para("TOTAL AMT: INR " + t.totalAmount, true),
          ],
        },
      ],
    }),
  );
}
export async function invoiceDocx(i, balance) {
  const c = i.companySnapshot;
  const values = [
    ["Invoice", i.invoiceNumber],
    ["Date", new Date(i.invoiceDate).toLocaleDateString("en-IN")],
    ["Due date", new Date(i.dueDate).toLocaleDateString("en-IN")],
    ["Invoiced to", i.invoicedTo],
    ["Address", i.billingAddress],
    [
      "Period",
      new Date(i.periodFrom).toLocaleDateString("en-IN") +
        " to " +
        new Date(i.periodTo).toLocaleDateString("en-IN"),
    ],
    ["Location", i.location],
    ["GSTIN", c.gstin],
    ["Customer / DHL GSTIN", [i.gstin, i.dhlGstin].filter(Boolean).join(" / ")],
    ["SAC", i.sacNo],
    [
      "State / code / place of supply",
      [i.state, i.stateCode, i.placeOfSupply].join(" / "),
    ],
    ["Taxable value", i.baseAmount],
    ["CGST (" + i.cgstRate + "%)", i.cgstAmount],
    ["SGST (" + i.sgstRate + "%)", i.sgstAmount],
    ["IGST (" + i.igstRate + "%)", i.igstAmount],
    ["Round off", i.roundOff],
    ["TOTAL INR", i.totalAmount],
    ["Received", balance.received],
    ["Outstanding", balance.outstanding],
  ];
  return Packer.toBuffer(
    new Document({
      sections: [
        {
          children: [
            para(c.name, true),
            para(c.tagline),
            para(c.address),
            para([c.phone, c.email].join(" | ")),
            para(
              i.status === "Cancelled"
                ? "CANCELLED TAX INVOICE"
                : "TAX INVOICE",
              true,
            ),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: values.map(row),
            }),
            para(i.description),
            para(i.amountInWords, true),
            para("PAN: " + c.pan),
            para(
              "Bank: " +
                c.bankName +
                " | Account: " +
                c.bankAccount +
                " | IFSC: " +
                c.bankIfsc,
            ),
            ...[c.disputeClause, c.interestClause, c.paymentClause]
              .filter(Boolean)
              .map((v) => para(v)),
            para("Authorised Signatory", true),
          ],
        },
      ],
    }),
  );
}
