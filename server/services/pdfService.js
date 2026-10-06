import PDFDocument from "pdfkit";
export function invoicePdf(i, balance) {
  return new Promise((resolve, reject) => {
    const d = new PDFDocument({ size: "A4", margin: 45 });
    const chunks = [];
    d.on("data", (b) => chunks.push(b));
    d.on("end", () => resolve(Buffer.concat(chunks)));
    d.on("error", reject);
    const c = i.companySnapshot;
    const amt = (n) =>
      "INR " +
      Number(n || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    const line = (label, value) =>
      d
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#24364b")
        .text(label + ": " + (value || "—"))
        .moveDown(0.5);
    d.font("Helvetica-Bold").fontSize(20).fillColor("#142d4e").text(c.name);
    d.font("Helvetica")
      .fontSize(10)
      .text(c.tagline || "")
      .text(c.address || "")
      .text([c.phone, c.email].filter(Boolean).join(" | "));
    d.moveDown();
    d.font("Helvetica-Bold")
      .fontSize(16)
      .text(i.status === "Cancelled" ? "CANCELLED TAX INVOICE" : "TAX INVOICE");
    d.moveDown();
    line("Invoice", i.invoiceNumber);
    line("Invoice date", new Date(i.invoiceDate).toLocaleDateString("en-IN"));
    line("Due date", new Date(i.dueDate).toLocaleDateString("en-IN"));
    line(
      "Billing period",
      new Date(i.periodFrom).toLocaleDateString("en-IN") +
        " - " +
        new Date(i.periodTo).toLocaleDateString("en-IN"),
    );
    line("Invoiced to", i.invoicedTo);
    line("Address", i.billingAddress);
    line("Location", i.location);
    line("Company GSTIN", c.gstin);
    line(
      "Customer / DHL GSTIN",
      [i.gstin, i.dhlGstin].filter(Boolean).join(" / "),
    );
    line("SAC", i.sacNo);
    line(
      "State / code / supply",
      [i.state, i.stateCode, i.placeOfSupply].join(" / "),
    );
    d.moveDown();
    d.font("Helvetica-Bold").text("Description");
    d.font("Helvetica").text(i.description);
    d.moveDown();
    for (const [label, value] of [
      ["Taxable value", i.baseAmount],
      ["CGST (" + i.cgstRate + "%)", i.cgstAmount],
      ["SGST (" + i.sgstRate + "%)", i.sgstAmount],
      ["IGST (" + i.igstRate + "%)", i.igstAmount],
      ["Round off", i.roundOff],
      ["Grand total", i.totalAmount],
      ["Received", balance.received],
      ["Outstanding", balance.outstanding],
    ])
      line(label, amt(value));
    d.font("Helvetica-Bold").text(i.amountInWords);
    d.moveDown();
    line("PAN", c.pan);
    line("Bank", c.bankName);
    line("Account", c.bankAccount);
    line("IFSC", c.bankIfsc);
    for (const note of [c.disputeClause, c.interestClause, c.paymentClause])
      if (note) d.font("Helvetica").fontSize(9).text(note).moveDown(0.3);
    d.moveDown()
      .font("Helvetica-Bold")
      .text("Authorised Signatory", { align: "right" });
    d.end();
  });
}
