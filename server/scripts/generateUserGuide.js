import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from "docx";

const outDir = path.resolve("docs");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const docxPath = path.join(outDir, "Lucky_Transport_User_Guide.docx");
const pdfPath = path.join(outDir, "Lucky_Transport_User_Guide.pdf");
const mdPath = path.join(outDir, "USER_GUIDE.md");

console.log("Generating documentation files in:", outDir);

// -------------------------------------------------------------
// Document Content Data
// -------------------------------------------------------------
const sections = [
  {
    title: "1. Executive Overview & System Purpose",
    paragraphs: [
      "Lucky Transport Services is a dedicated, mobile-first transport operations and billing management system built for Lucky Transport Services, Mumbai. It connects day-to-day transport activities—such as vehicle allocation, trip logging, and driver tracking—directly with financial billing, GST compliance, invoice generation, and customer payment reconciliation.",
      "The application eliminates manual calculation errors, enforces strict financial checks, ensures no trip or vehicle component is double-billed, and provides clients with clean, audited, and transparent billing records."
    ],
    subsections: [
      {
        subtitle: "1.1 Access Roles & Security Boundaries",
        points: [
          "Administrator (Admin): Complete control over company profile, tax configurations, user management, shift allowances, and master rate charts.",
          "Operations Manager (Manager): Full operational control over vehicles, drivers, customer records, trip entries, branded shift logs, invoice preparation, GST records, payments, and Excel imports/exports.",
          "Driver (Driver): Mobile-optimized view strictly restricted to their own assigned trips and schedule. Drivers cannot view commercial rates, customer invoices, or other vehicles."
        ]
      }
    ]
  },
  {
    title: "2. Master Configuration (Fleet, Rates & Customers)",
    paragraphs: [
      "Masters establish the baseline rules of your transport operations. All trips and invoices pull from these verified records."
    ],
    subsections: [
      {
        subtitle: "2.1 Vehicle Master & Compliance Tracking",
        points: [
          "Vehicle Identity: Normalized vehicle registration numbers (e.g. MH02ER6375), vehicle types (8 FT, 9 FT, 14 FT, 17 FT, 19 FT, 20 FT, Above 20 FT, or Custom), and carrying capacity.",
          "Operational Mode: Classified as Adhoc (flexible trip-based fleet) or Branded (dedicated monthly customer deployment).",
          "Four Regulatory Compliance Permits: Each vehicle tracks 4 key legal documents with automatic expiration alerts:",
          "  • Valid Insurance & Insurance Expiry Date",
          "  • Valid PUC & PUC Expiry Date",
          "  • Valid Fitness Permit & Fitness Permit Expiry Date (mandatory for branded operations)",
          "  • Valid Advertising Permit & Advertising Expiry Date",
          "Expiry Alerts: If any document is within 7 days of expiration (or overdue), warning badges appear immediately on the operations dashboard, and automated email alerts are triggered.",
          "Vehicle Statuses: Active, On Trip, Maintenance, or Inactive. Unavailable vehicles cannot be dispatched on trips."
        ]
      },
      {
        subtitle: "2.2 Driver Management",
        points: [
          "Full driver profiles including contact number, license number, license expiration date, age, address, and assigned primary vehicle.",
          "Status tracking: Active, On Leave, or Inactive. Drivers on leave cannot be assigned to new trips.",
          "Linked Driver Login: Drivers can sign in on mobile to view their real-time trip sheets."
        ]
      },
      {
        subtitle: "2.3 Customer Profiles & Credit Terms",
        points: [
          "Company details, primary contacts, addresses, state, and official 2-digit Indian State Code (e.g., Maharashtra 27).",
          "Tax identification: Registered GSTIN and specialized customer identifiers (such as DHL GSTIN).",
          "Credit terms: Allowed credit days (defaults to 30 days) and opening balance for financial reconciliation."
        ]
      },
      {
        subtitle: "2.4 Sites & Locations",
        points: [
          "Intercity Sites: Fixed hub-to-hub routes such as Inbound (MIDC to Cargo) and Outbound (Marwah to Cargo).",
          "Special & Depot Sites: GGT1 (Goregaon), Byculla, Vidhyavihar (VVR), Pune/PNQ, or custom origin-destination pairs.",
          "Location Routing: Allows selecting saved origin and destination points with automatic route matching."
        ]
      },
      {
        subtitle: "2.5 Rate Charts & Tariffs",
        points: [
          "Kilometre-Based Services: Distance-slab tariffs for 0–50 KM, 50–150 KM, and Above 150 KM per-KM rates.",
          "Overtime & Detention Rules:",
          "  • Trips up to 150 KM include 8 base hours; duty beyond 8 hours incurs overtime at the vehicle's saved detention rate.",
          "  • Trips above 150 KM (Special multi-day trips like Cargo to Nashik) include 8 base hours; duty beyond 8 hours incurs overtime at the rate chart's detention rate.",
          "  • Pune/PNQ trips above 150 KM include 16 base hours for extended detention at the PNQ detention rate.",
          "Trip-Based City Services: Standard 8-hour city package rate with transparent additional hour overtime cost.",
          "Fixed Monthly Rates: Monthly rate chart mapping vehicle type, site, and contracted shift hours (e.g., 8 hours - 3,000 KM).",
          "ACC Passes & Monthly Charges: Dedicated records for ACC daily/monthly passes and vehicle toll/parking allocations."
        ]
      }
    ]
  },
  {
    title: "3. Trip Operations & Workflow",
    paragraphs: [
      "Trip management ensures every journey is logged with exact timestamps, mileage, challan identifiers, and customer references."
    ],
    subsections: [
      {
        subtitle: "3.1 Creating & Editing Adhoc Trips",
        points: [
          "Step 1 - Assignment: Select billing customer, site/location, adhoc vehicle, and journey date.",
          "Step 2 - Journey Details: For city trips, capture CHA name / HUID and arrival times. For kilometre trips, capture AWB number, toll/parking expenses, distance band (0–50 KM, 50–150 KM, or Above 150 KM with total KM), and origin/destination.",
          "Step 3 - Duty Timing: Enter opening time and closing time (HH:mm format). For journeys spanning overnight or multiple days, check 'Multi-day trip' and enter the closing date.",
          "Step 4 - Calculate & Review: The server calculates duty hours down to the exact minute, verifies base hours, computes overtime hours, applies distance rates, and shows an instant transparent summary.",
          "Step 5 - Save: Save as Draft for further review or Submit for operational approval."
        ]
      },
      {
        subtitle: "3.2 The Single Challan Rule",
        points: [
          "One Challan = One Trip. Each delivery challan represents a distinct operational trip.",
          "Continuation entries sharing the same explicit challan number belong to that single trip, ensuring accurate billing without fragmented records."
        ]
      },
      {
        subtitle: "3.3 Trip Status Progression",
        points: [
          "Draft: Editable by operations staff. Rates and timings can be adjusted.",
          "Submitted: Confirmed by operator with an assigned driver; vehicle is marked On Trip.",
          "Approved: Verified by management; locked from arbitrary edits and ready for billing.",
          "Completed: Operational journey finished.",
          "Invoiced: Trip has been consolidated into an issued GST Tax Invoice. Invoiced trips cannot be edited or billed again.",
          "Cancelled: Cancelled with an audited reason. Releases vehicles and drivers immediately."
        ]
      },
      {
        subtitle: "3.4 Bulk Excel Import",
        points: [
          "Upload standard monthly customer worksheets (XLSX/XLS up to 5 MB and 2,000 rows).",
          "Automatic header aliasing matches column names (Date, Vehicle, Opening/Closing times, Challans, etc.).",
          "Pre-import Validation Preview: Highlights invalid vehicle numbers, missing rates, or date formatting errors before writing to the database.",
          "Transactional confirmation creates verified trips with zero duplicate entries."
        ]
      }
    ]
  },
  {
    title: "4. Dedicated Branded Fleet Operations",
    paragraphs: [
      "Branded operations cater to corporate clients (like DHL Express) who lease dedicated vehicles on monthly shifts."
    ],
    subsections: [
      {
        subtitle: "4.1 Branded Shift Logs",
        points: [
          "Logs daily 8-hour shift execution for assigned branded vehicles.",
          "Tracks opening odometer KM, closing odometer KM, total distance, and opening/closing times.",
          "Held / Loading Locations: Marks shifts where a vehicle was held on standby or loading (zero road KM).",
          "Domestic Airport Entry Fees: Records reimbursable airport entry charges outside GST."
        ]
      },
      {
        subtitle: "4.2 Weekly Offs & Shift Allowances",
        points: [
          "Standard shift models: 8 hours (3,000 KM/month), 16 hours (4,000 KM/month), or 24 hours (5,000 KM/month).",
          "Weekly Off Logging: Specific off-dates are recorded per vehicle. Shifts worked on designated weekly offs automatically incur Additional Service Charges (ADC) without double-counting regular monthly hours."
        ]
      }
    ]
  },
  {
    title: "5. Billing & Invoicing Engine",
    paragraphs: [
      "The invoicing engine consolidates approved transport services into legally compliant GST Tax Invoices."
    ],
    subsections: [
      {
        subtitle: "5.1 Three Invoicing Models",
        points: [
          "Model A - Adhoc Invoicing: Selects approved/completed trips for a customer and site over a date range. Attaches monthly parking allowances or ACC passes, applies tax, and generates the consolidated invoice.",
          "Model B - Fixed Monthly Fleet Invoicing: Billed on contracted monthly shift rates and monthly KM allowance. Includes fleet management salaries.",
          "Model C - Variable Fleet Invoicing: Calculates actual monthly fuel reimbursement using the verified formula: Total KM ÷ Mileage × Fuel Rate. Computes Additional Service Charges (ADC) from excess duty minutes (Excess Minutes ÷ 480 × 8-hour rate), AMC charges, and non-taxable airport reimbursements."
        ]
      },
      {
        subtitle: "5.2 Indian GST Compliance & Rounding",
        points: [
          "Intrastate Billing (e.g. Maharashtra to Maharashtra): Automatically splits tax evenly into CGST (e.g. 9%) and SGST (e.g. 9%).",
          "Interstate Billing: Applies IGST (e.g. 18%) exclusively.",
          "Round to Rupee: Automatically computes standard decimal round-off.",
          "Amount in Words: Auto-generates formal Indian currency text (e.g., 'Rupees Fourteen Thousand Five Hundred and Fifty Only')."
        ]
      },
      {
        subtitle: "5.3 Multi-Format Export Package",
        points: [
          "PDF Tax Invoice: Clean, print-ready formal invoice with company details, bank coordinates, and line items.",
          "Narration & Calculation Annexure: Detailed breakdown table showing vehicle-by-vehicle KM, fuel metrics, and duty hours.",
          "Word (.docx) Document: Editable formal invoice matching corporate styling.",
          "Supporting Excel (.xlsx): Full cell-by-cell spreadsheet for customer reconciliation."
        ]
      }
    ]
  },
  {
    title: "6. Payment Tracking & Customer Receivables",
    paragraphs: [
      "Real-time financial reconciliation keeps track of billed amounts, received payments, and pending balances."
    ],
    subsections: [
      {
        subtitle: "6.1 Recording Payments & Guarding Against Overpayment",
        points: [
          "Supports multiple payment modes: Bank Transfer (NEFT/RTGS/IMPS), UPI, Cheque, and Cash.",
          "Partial Payments: Clients can pay across multiple installments; each receipt logs payment date, reference number, and notes.",
          "Overpayment Prevention: The system strictly blocks entering payment amounts exceeding the outstanding balance.",
          "Automatic Status Updates: Invoices update automatically from Pending $\\rightarrow$ Partially Paid $\\rightarrow$ Paid.",
          "Overdue Alerts: Tracks overdue invoices calculated relative to Indian midnight (Asia/Kolkata)."
        ]
      },
      {
        subtitle: "6.2 Customer Balance Statements",
        points: [
          "Reports provide real-time visibility per customer: Opening Balance + Total Billed - Total Received = Net Outstanding.",
          "Historical GST register combines generated invoices with past imported records for complete tax audits."
        ]
      }
    ]
  },
  {
    title: "7. Step-by-Step Cheatsheet for Common Operations",
    paragraphs: [
      "Quick instructions for your daily operations."
    ],
    subsections: [
      {
        subtitle: "How to Add a Vehicle with Compliance Permits",
        points: [
          "1. Go to Vehicles $\\rightarrow$ Click '+ Add'.",
          "2. Enter Registration Number (e.g., MH02ER6375) and select Vehicle Type (e.g., 17 FT).",
          "3. Select Mode: Check 'Branded vehicle' for monthly leased vehicles, or leave unchecked for adhoc.",
          "4. For branded vehicles, select Assigned Shift (e.g. 8 hours - 3000 KM) and enter ADC / AMC rates.",
          "5. Check 'Valid insurance' and enter Insurance Expiry Date.",
          "6. Check 'Valid PUC' and enter PUC Expiry Date.",
          "7. Check 'Valid fitness permit' and enter Fitness Permit Expiry Date.",
          "8. Check 'Valid advertising permit' and enter Advertising Expiry Date.",
          "9. Click 'Save record'."
        ]
      },
      {
        subtitle: "How to Record an Above 150 KM Multi-Day Trip with Overtime",
        points: [
          "1. Go to Trips $\\rightarrow$ Click '+ Adhoc trip'.",
          "2. Select Billing Customer (e.g. TEST DHL), Location (e.g. Special), and Vehicle.",
          "3. Under Kilometre Service, choose 'Above 150 KM' and enter Total KM (e.g. 600 KM).",
          "4. Enter Origin (e.g. Cargo) and Destination (e.g. Nashik).",
          "5. Enter Opening Time (e.g. 21:15) and Closing Time (e.g. 00:00).",
          "6. Check 'Multi-day trip' and select the Closing Date (e.g. 29-10-2026).",
          "7. Click 'Calculate & review'.",
          "8. Review the summary: Base 8 hours included, overtime hours calculated, and detention rate applied.",
          "9. Click 'Save trip'."
        ]
      },
      {
        subtitle: "How to Create and Issue a Monthly Invoice",
        points: [
          "1. Go to Invoices $\\rightarrow$ Click '+ New invoice'.",
          "2. Select Billing Customer and Billing Type (Adhoc, Fixed, or Variable).",
          "3. Select Billing Period From and To dates. (Ensure rate charts are effective on or before the From date).",
          "4. For Adhoc, check the eligible approved trips. For Fixed/Variable, check the assigned branded vehicles.",
          "5. Verify GST tax percentages (CGST/SGST or IGST) and check 'I verified tax configuration'.",
          "6. Click 'Calculate narration & review'.",
          "7. Inspect the detailed line-item table, fuel metrics, and tax calculation.",
          "8. Click 'Issue invoice' to finalize. Download PDF, Word, or Excel copies as needed."
        ]
      }
    ]
  }
];

// -------------------------------------------------------------
// 1. Generate Markdown File
// -------------------------------------------------------------
function generateMarkdown() {
  let md = "# Lucky Transport Services — Comprehensive Operations & Client User Guide\n\n";
  md += "**Application Version:** 1.1 | **Updated:** November 2026\n";
  md += "**Headquarters:** Mumbai, Maharashtra | **Platform:** Web & Mobile Operations Workspace\n\n";
  md += "---\n\n";

  for (const s of sections) {
    md += `## ${s.title}\n\n`;
    for (const p of s.paragraphs) {
      md += `${p}\n\n`;
    }
    if (s.subsections) {
      for (const sub of s.subsections) {
        md += `### ${sub.subtitle}\n\n`;
        for (const pt of sub.points) {
          md += `- ${pt}\n`;
        }
        md += "\n";
      }
    }
  }

  fs.writeFileSync(mdPath, md, "utf8");
  console.log("Markdown user guide written to:", mdPath);
}

// -------------------------------------------------------------
// 2. Generate Word (.docx) File
// -------------------------------------------------------------
async function generateDocx() {
  const docChildren = [];

  // Title & Header
  docChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "LUCKY TRANSPORT SERVICES",
          bold: true,
          size: 36,
          color: "142D4E",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Operations & Billing Management System — Client & User Guide",
          bold: true,
          size: 26,
          color: "2E5A88",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Version 1.1  |  Mumbai, India  |  Confidential & Operational",
          italics: true,
          size: 20,
          color: "666666",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    })
  );

  for (const sec of sections) {
    docChildren.push(
      new Paragraph({
        text: sec.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      })
    );

    for (const p of sec.paragraphs) {
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: p, size: 22 })],
          spacing: { after: 100 },
        })
      );
    }

    if (sec.subsections) {
      for (const sub of sec.subsections) {
        docChildren.push(
          new Paragraph({
            text: sub.subtitle,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 180, after: 80 },
          })
        );

        for (const pt of sub.points) {
          const isBoldPrefix = pt.includes(":");
          if (isBoldPrefix) {
            const [lead, ...rest] = pt.split(":");
            docChildren.push(
              new Paragraph({
                children: [
                  new TextRun({ text: "• " + lead + ":", bold: true, size: 21 }),
                  new TextRun({ text: rest.join(":"), size: 21 }),
                ],
                spacing: { after: 60 },
              })
            );
          } else {
            docChildren.push(
              new Paragraph({
                children: [new TextRun({ text: "• " + pt, size: 21 })],
                spacing: { after: 60 },
              })
            );
          }
        }
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docChildren,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(docxPath, buffer);
  console.log("Word document written to:", docxPath);
}

// -------------------------------------------------------------
// 3. Generate PDF File
// -------------------------------------------------------------
function generatePdf() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Header styling helper
    const primaryColor = "#142d4e";
    const secondaryColor = "#2b580c";
    const textColor = "#222222";

    // Title Page / Top Banner
    doc
      .fillColor(primaryColor)
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("LUCKY TRANSPORT SERVICES", { align: "center" });

    doc
      .fontSize(14)
      .fillColor("#2E5A88")
      .text("Operations & Billing Management System", { align: "center" });

    doc
      .fontSize(11)
      .font("Helvetica-Oblique")
      .fillColor("#666666")
      .text("Complete Client & Operational User Guide  •  Version 1.1", {
        align: "center",
      });

    doc.moveDown(1);
    doc
      .strokeColor("#d6dce4")
      .lineWidth(1)
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .stroke();
    doc.moveDown(1);

    for (const sec of sections) {
      // Check page overflow
      if (doc.y > 680) doc.addPage();

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text(sec.title);
      doc.moveDown(0.3);

      doc.fontSize(9.5).font("Helvetica").fillColor(textColor);
      for (const p of sec.paragraphs) {
        if (doc.y > 700) doc.addPage();
        doc.text(p, { align: "justify", lineGap: 2 });
        doc.moveDown(0.4);
      }

      if (sec.subsections) {
        for (const sub of sec.subsections) {
          if (doc.y > 690) doc.addPage();

          doc
            .fontSize(11)
            .font("Helvetica-Bold")
            .fillColor("#1c3b57")
            .text(sub.subtitle);
          doc.moveDown(0.2);

          doc.fontSize(9).font("Helvetica").fillColor(textColor);
          for (const pt of sub.points) {
            if (doc.y > 710) doc.addPage();
            if (pt.includes(":")) {
              const [lead, ...rest] = pt.split(":");
              doc
                .font("Helvetica-Bold")
                .text("  • " + lead + ":", { continued: true })
                .font("Helvetica")
                .text(rest.join(":"), { lineGap: 1.5 });
            } else {
              doc.text("  • " + pt, { lineGap: 1.5 });
            }
          }
          doc.moveDown(0.5);
        }
      }
      doc.moveDown(0.5);
    }

    doc.end();
    stream.on("finish", () => {
      console.log("PDF document written to:", pdfPath);
      resolve();
    });
    stream.on("error", reject);
  });
}

// -------------------------------------------------------------
// Run Generators
// -------------------------------------------------------------
async function run() {
  generateMarkdown();
  await generateDocx();
  await generatePdf();
  console.log("All client guides generated successfully!");
}

run().catch((e) => {
  console.error("Documentation generation failed:", e);
  process.exit(1);
});
