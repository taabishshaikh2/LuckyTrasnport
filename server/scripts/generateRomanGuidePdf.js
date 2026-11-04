import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const docsDir = path.resolve("docs");
const imagesDir = path.join(docsDir, "images");
const pdfPath = path.join(docsDir, "Lucky_Transport_User_Guide_Roman_English.pdf");
const mdPath = path.join(docsDir, "USER_GUIDE_ROMAN_ENGLISH.md");

console.log("Generating Roman English Layman Guide...");

// -------------------------------------------------------------
// Markdown Content
// -------------------------------------------------------------
const mdContent = `# Lucky Transport Services — Aasan Bhasha Me App User Guide (Roman English)

**Document Version:** 1.2  
**Date:** November 2026  
**Location:** Mumbai, Maharashtra  

---

## 1. App Ka Maqsad Aur Kaam Karne Ka Tarika (Overview)

Yeh app Lucky Transport Services ke rozana ke transport kaam aur billing ko digital aur aasan banane ke liye banayi gayi hai.
Is app ke zariye aap gaadiyan (vehicles), drivers, customers, roz ke trips (challans), diesel/fuel kharcha, aur GST tax invoice sab ek hi jagah manage kar sakte hain.

---

## 2. Sabse Zaroori Rule: System Dependency (Kise Pehle Add Karna Hai?)

Transport app me har cheez ek dusre se judi hui hai. Agar aap galat order me kaam karenge toh error aayega. Isliye hamesha is sequence ko follow karein:

\`\`\`
[1. Customer Add Karo] ──┐
                         ├───> [4. Trip / Duty Banao] ───> [5. Trip Approve Karo] ───> [6. Invoice / Bill] ───> [7. Payment Record]
[2. Vehicle Add Karo]  ──┤              ▲
                         │              │
[3. Rate Chart Set Karo] ─┴──────────────┘
\`\`\`

### Zaroori Dependency Rules (Dhyan Me Rakhne Wali Baatein):
1. **Pehle Customer & Vehicle:** Agar system me Customer ya Vehicle add nahi hai, toh aap Trip nahi bana sakte (dropdown me gaadi ya party ka naam hi nahi dikhega).
2. **Rate Chart Zaroori Hai:** Agar kisi vehicle type (jaise 8 FT ya 17 FT) ka Rate Chart me rate save nahi hai, toh system trip ka amount calculate nahi kar payega aur save nahi karne dega.
3. **Trip Approve Honi Chahiye:** Jab tak trip ko Manager "Approve" nahi karta, tab tak woh Invoice banate waqt list me nahi aayegi. Unapproved trip ka bill nahi ban sakta.
4. **Rate Chart Valid From Date:** Monthly Fixed invoice banate waqt Rate Chart ki "Valid from" date hamesha billing period ke shuru hone ki date (ya usse pehle ki) honi chahiye.
5. **Invoice Ke Baad Payment:** Jab tak Invoice issue nahi hoga, tab tak aap customer se aayi hui payment ko record nahi kar sakte.

---

## 3. Step 1: Gaadi (Vehicle) Kaise Add Karein?

Gaadi add karne ke liye **Vehicles** page par jayein aur **'+ Add'** button dabayein.

### Bhari Jane Wali Details:
1. **Vehicle number:** Gaadi ka number daalein (jaise: \`MH02ER6375\` ya \`MH02GS1735\`).
2. **Vehicle type:** Gaadi ka size chunein (jaise: \`8 FT\`, \`9 FT\`, \`14 FT\`, \`17 FT\`, \`20 FT\`, wagera).
3. **Branded vehicle checkbox:**
   - Agar gaadi kisi company (jaise DHL) me monthly fixed contract par chalti hai, toh **Branded vehicle** check karein.
   - Agar gaadi normal adhoc / daily trip par chalti hai, toh ise unchecked rehne dein.
4. **Assigned Shift:** Branded gaadi ke liye shift select karein (jaise: \`8 hours - 3000 KM\`).
5. **Chaar (4) Compliance Permits (Document Expiry Checks):**
   - **Valid insurance:** Checkbox tick karein aur Insurance Expiry Date daalein.
   - **Valid PUC:** Checkbox tick karein aur PUC Expiry Date daalein.
   - **Valid fitness permit:** Checkbox tick karein aur Fitness Expiry Date daalein.
   - **Valid advertising permit:** Checkbox tick karein aur Advertising Expiry Date daalein.

> **Tip:** Agar kisi document ka checkbox tick karenge toh date daalna zaroori hai. Jab bhi kisi document ki expiry me 7 din bachenge, system dashboard par laal warning alert dikhayega aur automatically email reminder bhejega.

---

## 4. Step 2: Rate Chart Kaise Set Karein?

Rate Chart set karne ke liye **More $\\rightarrow$ Rate chart** par jayein.

### A. Kilometre Based Services (Adhoc Trips Ke Liye)
- Yahan har gaadi ke size ke hisab se 3 slabs hote hain:
  - **0-50 KM:** Fixed charge (jaise 8 FT ke liye ₹2,200).
  - **Above 50-150 KM:** Fixed charge (jaise 8 FT ke liye ₹3,300).
  - **Above 150 KM / KM:** Har kilometre ka rate (jaise 8 FT ke liye ₹18/KM).
  - **Detention after 8 hrs:** Normal aur Special trips me 8 ghante ke baad lagne wala overtime rate (jaise ₹200/ghanta).
  - **PNQ detention after 16 hrs:** Pune/PNQ trips me 16 ghante ke baad lagne wala rate (jaise ₹200/ghanta).

### B. Trip Based / City Limits (City Trips Ke Liye)
- Sheher ke andar chalne wali gaadiyon ke liye 8 ghante ka trip rate aur additional hour overtime cost set karein (Night detention charge ab system se hata diya gaya hai).

### C. Fixed Monthly Rates (Branded Contract Ke Liye)
- Branded gaadiyon ke liye Customer chunein (jaise TEST DHL), Site \`Branded\`, Vehicle type (jaise 17 FT), Shift hours (8 hours - 3000 KM), aur Fixed rate per KM daalein.
- **Important:** "Valid from" date ko hamesha us mahine ki 1 tareekh ya usse pehle ka rakhein jis mahine ka bill banana hai!

---

## 5. Step 3: Trip Kaise Add Karein (Adhoc & Special Trips)

Trip add karne ke liye **Trips $\\rightarrow$ '+ Adhoc trip'** par click karein.

### Step-by-Step Tarika:
1. **Billing customer:** Customer chunein (jaise TEST DHL).
2. **Location / site:** Location chunein (jaise Inbound, Outbound, ya Special).
3. **Adhoc vehicle:** Gaadi chunein (dropdown me sirf wahi gaadiyan aayengi jo step 1 me add ki gayi hain).
4. **Date & AWB:** Trip ki date aur AWB / Challan number daalein.
5. **Kilometre service:**
   - Agar 150 KM se zyada ka lamba trip hai, toh **Above 150 KM** chunein aur **Total KM** daalein (jaise 600 KM).
   - Origin (jaise Cargo) aur Destination (jaise Nashik) daalein.
6. **Opening & Closing Time:** Opening time (jaise 21:15) aur Closing time (jaise 00:00) daalein.
7. **Multi-day trip (Aham Feature):**
   - Agar gaadi agle din ya 2 din baad pohanchi hai, toh **Multi-day trip** checkbox ko tick karein aur **Closing date** select karein.
8. **Calculate & review:** Button dabayein.
   - System khud ba khud total duty hours calculate karega (jaise 26.75 hours).
   - 8 ghante base duty minus karke bache hue 18.75 ghante ka Overtime (OT) rate chart ke hisab se calculate kar dega!
9. **Save trip:** Save button daba kar trip submit karein.

> **Single Challan Rule:** Ek Challan = Ek Trip. Ek hi challan ke multiple rows ek hi trip ka hissa bante hain taaki billing bilkul saaf rahe.

---

## 6. Step 4: Trip Approve Karna

- Trip save hone ke baad **Submitted** status me hoti hai.
- Manager trip details check karega aur **'Approve trip'** button dabayega.
- Jab trip **Approved** ho jayegi, tabhi woh billing/invoice ke liye ready hogi.

---

## 7. Step 5: Invoice (Bill) Kaise Banayein?

Invoice banane ke liye **Invoices $\\rightarrow$ '+ New invoice'** par click karein.

### A. Adhoc Invoice (Trips Ka Bill):
1. Billing Customer chunein.
2. Invoice Type me **Adhoc** chunein.
3. Billing Period (From aur To dates) select karein.
4. Niche **Select trips** me un sabhi approved trips ko tick karein jinka bill banana hai.
5. Agar monthly parking ya pass shamil karna hai, toh **Include monthly parking/pass** tick karein.
6. GST tax check karein (Maharashtra ke liye CGST 9% + SGST 9%, bahar ke liye IGST 18%).
7. **'Calculate narration & review'** dabayein.
8. Pura hisab check karke **'Issue invoice'** par click karein.

### B. Fixed Monthly Invoice (Branded Gaadi Ka Bill):
1. Billing Customer chunein (jaise TEST DHL).
2. Invoice Type me **Fixed** chunein.
3. Billing period dates daalein (jaise 01-11-2026 se 04-11-2026).
4. Branded vehicle tick karein.
5. Agar Fleet Manager ka salary add karna hai toh manager tick karein.
6. Review karke **'Issue invoice'** dabayein.

### C. Download Karna:
Invoice issue hote hi aap ek click me:
- **PDF Tax Invoice** (Formal print-ready bill narration ke sath)
- **Word Document (.docx)** (Editable format)
- **Excel Spreadsheet (.xlsx)** (Customer checking ke liye)
download kar sakte hain.

---

## 8. Step 6: Payment Entry Kaise Karein?

Jab customer se payment aaye:
1. **Invoices** page par jayein aur us invoice ko open karein.
2. **'Record payment'** button dabayein.
3. Amount, Payment Date, Payment Mode (Bank Transfer, UPI, Cheque, ya Cash) aur Reference/UTR Number daalein.
4. Save karein.
- Agar pura paisa aa gaya, toh invoice **Paid** ho jayegi.
- Agar thoda paisa aaya, toh **Partially Paid** dikhayegi aur bacha hua balance automatic calculate karegi.
- System outstanding se zyada payment lene se rokta hai (Overpayment Guard).

---

## 9. Rozana Ka Kaam: 1-Minute Cheatsheet

| Kaam | Kahan Jana Hai | Kya Karna Hai |
|---|---|---|
| Nayi Gaadi Add Karna | Vehicles $\\rightarrow$ + Add | Number, Type, aur 4 Permits (Insurance, PUC, Fitness, Advertising) expiry dates ke sath daalein. |
| Naya Rate Set Karna | More $\\rightarrow$ Rate chart | KM rate, City rate ya Monthly fixed rate save karein. |
| Nayi Trip Dalna | Trips $\\rightarrow$ + Adhoc trip | Customer + Gaadi + Time + KM daal kar 'Calculate & review' karein aur save karein. |
| Trip Approve Karna | Trips $\\rightarrow$ Trip open karein | 'Approve trip' click karein. |
| Bill / Invoice Banana | Invoices $\\rightarrow$ + New invoice | Customer + Dates select karke trips tick karein aur 'Issue invoice' karein. |
| Payment Dalna | Invoices $\\rightarrow$ Invoice open | 'Record payment' karke amount aur UTR number daalein. |
| Expiry Check Karna | Home Dashboard | Dashboard alerts check karein kaunse documents expire hone wale hain. |
`;

fs.writeFileSync(mdPath, mdContent, "utf8");
console.log("Markdown guide written to:", mdPath);

// -------------------------------------------------------------
// PDF Generation with PDFKit
// -------------------------------------------------------------
function generatePdf() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    const primaryColor = "#142d4e";
    const accentColor = "#005691";
    const darkText = "#1f2937";
    const lightBoxBg = "#f3f6fa";
    const borderCol = "#cbd5e1";

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right; // ~523 pt

    function header(title, size = 15) {
      if (doc.y > 680) doc.addPage();
      doc.moveDown(0.6);
      doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(size).text(title);
      doc.strokeColor(accentColor).lineWidth(1.5).moveTo(doc.page.margins.left, doc.y + 2).lineTo(doc.page.margins.left + contentWidth, doc.y + 2).stroke();
      doc.moveDown(0.5);
    }

    function subheader(title, size = 11) {
      if (doc.y > 690) doc.addPage();
      doc.moveDown(0.4);
      doc.fillColor(accentColor).font("Helvetica-Bold").fontSize(size).text(title);
      doc.moveDown(0.2);
    }

    function para(text, size = 9.5) {
      if (doc.y > 710) doc.addPage();
      doc.fillColor(darkText).font("Helvetica").fontSize(size).text(text, { align: "justify", lineGap: 2 });
      doc.moveDown(0.3);
    }

    function bullet(label, text, size = 9) {
      if (doc.y > 715) doc.addPage();
      doc.fillColor(darkText).font("Helvetica-Bold").fontSize(size).text("  • " + label + ": ", { continued: true });
      doc.font("Helvetica").text(text, { lineGap: 2 });
      doc.moveDown(0.2);
    }

    function calloutBox(title, lines) {
      if (doc.y > 660) doc.addPage();
      const startY = doc.y;
      const boxHeight = lines.length * 15 + 32;
      doc.rect(doc.page.margins.left, startY, contentWidth, boxHeight).fillColor(lightBoxBg).fill();
      doc.rect(doc.page.margins.left, startY, contentWidth, boxHeight).strokeColor("#94a3b8").lineWidth(1).stroke();

      doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(10).text(title, doc.page.margins.left + 10, startY + 8);
      let curY = startY + 24;
      for (const line of lines) {
        doc.fillColor(darkText).font("Helvetica").fontSize(9).text(line, doc.page.margins.left + 12, curY);
        curY += 14;
      }
      doc.y = startY + boxHeight + 8;
    }

    function embedImage(imgPath, caption, maxH = 180) {
      if (!fs.existsSync(imgPath)) return;
      if (doc.y + maxH + 30 > doc.page.height - doc.page.margins.bottom) doc.addPage();
      
      const imgY = doc.y;
      try {
        doc.image(imgPath, {
          fit: [contentWidth, maxH],
          align: "center",
        });
        doc.y = imgY + maxH + 4;
        doc.fillColor("#64748b").font("Helvetica-Oblique").fontSize(8).text(caption, { align: "center" });
        doc.moveDown(0.5);
      } catch (e) {
        console.warn("Could not embed image:", imgPath, e.message);
      }
    }

    // =========================================================
    // PAGE 1: TITLE & SYSTEM DEPENDENCY FLOW
    // =========================================================
    doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(22).text("LUCKY TRANSPORT SERVICES", { align: "center" });
    doc.fillColor(accentColor).font("Helvetica-Bold").fontSize(13).text("App Chalane Ka Aasan Tarika (Roman English Layman Guide)", { align: "center" });
    doc.fillColor("#64748b").font("Helvetica").fontSize(9).text("Daily Operations, Fleet Masters, Trips, GST Invoices & Payments", { align: "center" });
    doc.moveDown(0.8);

    header("1. App Ka Maqsad Aur Kaam Karne Ka Tarika");
    para("Yeh app Lucky Transport Services ke transport operations aur billing ko aasan aur digital banane ke liye banayi gayi hai. Iske zariye gaadiyan (vehicles), drivers, customers, roz ke trips (challans), diesel kharcha, aur GST tax invoices sab ek jagah manage hote hain.");

    header("2. Sabse Zaroori Rule: System Dependency (Kise Pehle Add Karein?)");
    para("Transport app me har module ek dusre se juda hua hai. Agar aap galat order me kaam karenge toh error aayega. Niche diya gaya silsila (sequence) hamesha yaad rakhein:");

    calloutBox("GOLDEN DEPENDENCY SEQUENCE (Kaam Ka Sahi Order)", [
      "1. PEHLE: Customer aur Vehicle add karein (warna trip me select nahi hoga).",
      "2. PHIR: Rate Chart me us vehicle ka rate set karein (warna calculation fail hoga).",
      "3. TAB: Trip add karein aur exact time/KM daal kar 'Calculate & review' karein.",
      "4. ZAROORI: Trip ko 'Approve' karein (unapproved trip ka bill nahi ban sakta).",
      "5. INVOICE: Approved trips select karke GST Tax Invoice banayein.",
      "6. PAYMENT: Bill banne ke baad aane wali payment ko invoice me record karein."
    ]);

    para("Rule: Agar Vehicle add nahi hoga toh Trip nahi ban sakti. Agar Trip approve nahi hogi toh Invoice nahi ban sakti. Aur agar Invoice nahi hogi toh payment record nahi ho sakti!");

    // =========================================================
    // PAGE 2: VEHICLE MASTER & 4 PERMITS
    // =========================================================
    doc.addPage();
    header("3. Step 1: Gaadi (Vehicle) Kaise Add Karein?");
    para("Gaadi add karne ke liye left menu me 'Vehicles' par jayein aur '+ Add' button click karein.");

    bullet("Vehicle Number", "Gaadi ka number daalein (jaise MH02ER6375 ya MH02GS1735).");
    bullet("Vehicle Type", "Gaadi ka size chunein (jaise 8 FT, 9 FT, 14 FT, 17 FT, 20 FT, ya Custom).");
    bullet("Branded Vehicle Checkbox", "Agar gaadi kisi customer (jaise DHL) ke paas monthly fixed lease par chalti hai toh Branded check karein; daily adhoc gaadi ke liye unchecked rakhein.");
    bullet("Assigned Shift", "Branded gaadi ke liye shift select karein (jaise 8 hours - 3000 KM).");
    
    subheader("Chaar (4) Regulatory Compliance Documents (Expiry Tracking):");
    bullet("Valid Insurance", "Checkbox tick karein aur Insurance Expiry Date daalein.");
    bullet("Valid PUC", "Checkbox tick karein aur PUC Expiry Date daalein.");
    bullet("Valid Fitness Permit", "Checkbox tick karein aur Fitness Permit Expiry Date daalein.");
    bullet("Valid Advertising Permit", "Checkbox tick karein aur Advertising Permit Expiry Date daalein.");

    para("Note: Jab bhi kisi permit ki expiry me 7 din bachenge, dashboard par alert aayega aur automatic email reminder trigger hoga!");

    embedImage(path.join(imagesDir, "vehicle_add.png"), "Screenshot 1: Nayi Gaadi Add Karne Ka Popup (Chaar Permits Ke Sath)", 185);
    embedImage(path.join(imagesDir, "vehicle_detail.jpg"), "Screenshot 2: Saved Branded Gaadi Ka Detail View", 150);

    // =========================================================
    // PAGE 3: RATE CHART
    // =========================================================
    doc.addPage();
    header("4. Step 2: Rate Chart Kaise Set Karein?");
    para("Rate set karne ke liye left menu me 'More -> Rate chart' par jayein.");

    subheader("A. Kilometre Based Services (Adhoc Trips Ke Liye):");
    bullet("0-50 KM Slab", "50 KM tak ka fixed rate (jaise 8 FT ke liye ₹2,200).");
    bullet("Above 50-150 KM Slab", "150 KM tak ka fixed rate (jaise 8 FT ke liye ₹3,300).");
    bullet("Above 150 KM / KM", "150 KM se upar har KM ka rate (jaise 8 FT ke liye ₹18/KM).");
    bullet("Detention After 8 Hrs", "Normal aur Special trips me 8 ghante ke baad lagne wala overtime rate (jaise ₹200/hr).");
    bullet("PNQ Detention After 16 Hrs", "Pune/PNQ trips me 16 ghante ke baad lagne wala rate (jaise ₹200/hr).");

    subheader("B. Trip Based / City Limits (Local City Trips):");
    bullet("Fixed 8-Hour Rate", "Sheher ke andar 8 ghante ka trip charge aur extra ghante ka overtime rate. (Night detention charge system se hata diya gaya hai).");

    subheader("C. Fixed Monthly Rates (Branded Monthly Leased Gaadiyon Ke Liye):");
    bullet("Monthly Rate", "Customer, Site 'Branded', Vehicle Type, aur Shift hours ke hisab se monthly fixed per-KM rate save karein.");
    bullet("Valid From Date Rule", "Hamesha dhyan rakhein ki rate ki 'Valid from' date billing period shuru hone ki date (ya usse pehle) honi chahiye, warna invoice nahi banegi!");

    embedImage(path.join(imagesDir, "rate_chart_km.png"), "Screenshot 3: Kilometre Based Rates (0-50, 50-150, Above 150 KM & Detention)", 150);
    embedImage(path.join(imagesDir, "rate_chart_monthly.png"), "Screenshot 4: Fixed Monthly Rate (Shift & Valid From Date)", 150);

    // =========================================================
    // PAGE 4: TRIP ENTRY (ADHOC & SPECIAL MULTI-DAY)
    // =========================================================
    doc.addPage();
    header("5. Step 3: Trip Kaise Add Karein (Adhoc & Special Trips)");
    para("Trip add karne ke liye 'Trips -> + Adhoc trip' button dabayein.");

    bullet("1. Customer & Gaadi", "Billing customer (jaise TEST DHL), Site (jaise Special), aur Gaadi chunein.");
    bullet("2. Kilometre Service", "Agar 150 KM se zyada lamba safar hai toh 'Above 150 KM' chunein aur Total KM daalein (jaise 600 KM). Origin (Cargo) aur Destination (Nashik) daalein.");
    bullet("3. Timings & Multi-day Trip", "Opening time (21:15) aur Closing time (00:00) daalein. Agar gaadi agle din ya do din baad aayi hai toh 'Multi-day trip' checkbox tick karein aur Closing Date (jaise 29-10-2026) chunein.");
    bullet("4. Calculate & Review", "'Calculate & review' dabayein. System khud 26.75 hours calculate karega, 8 ghante base minus karega, aur bache hue 18.75 hours ka Overtime (OT) rate chart ke hisab se ₹3,750 jod dega!");
    bullet("5. Save Trip", "'Save trip' par click karke submit karein.");

    embedImage(path.join(imagesDir, "trip_add.png"), "Screenshot 5: Adhoc Trip Entry — Multi-day Trip aur Automatic OT Calculation", 180);
    embedImage(path.join(imagesDir, "trip_detail.png"), "Screenshot 6: Saved Trip Detail — KM, Duty Hours, OT aur Total Amount", 160);

    // =========================================================
    // PAGE 5: INVOICE GENERATION
    // =========================================================
    doc.addPage();
    header("6. Step 4 & 5: Trip Approve Karna Aur Invoice (Bill) Banana");
    para("Trip save hone ke baad Manager use check karke 'Approve trip' karega. Approved hone ke baad hi trip bill banne ke liye ready hoti hai!");

    subheader("Invoice Kaise Banayein:");
    bullet("1. Page Par Jayein", "'Invoices -> + New invoice' par click karein.");
    bullet("2. Customer & Type", "Billing customer chunein aur Invoice Type (Adhoc ya Fixed) select karein.");
    bullet("3. Billing Period", "From aur To date select karein.");
    bullet("4. Gaadi / Trips Select Karein", "Adhoc me un trips ko tick karein jinka bill banana hai. Fixed me branded gaadi ko tick karein.");
    bullet("5. GST Tax Verify Karein", "Maharashtra ke liye CGST 9% + SGST 9% daalein aur 'I verified tax configuration' tick karein.");
    bullet("6. Calculate & Issue", "'Calculate narration & review' par click karke amount verify karein aur 'Issue invoice' dabayein.");

    embedImage(path.join(imagesDir, "invoice_create.jpg"), "Screenshot 7: Create Invoice Screen — Fixed / Adhoc Billing & GST Tax", 210);

    // =========================================================
    // PAGE 6: PAYMENTS & DAILY CHEATSHEET
    // =========================================================
    doc.addPage();
    header("7. Step 6: Payment Entry Kaise Karein?");
    para("Jab customer se payment ka cheque, bank transfer (NEFT/RTGS), ya UPI aaye, toh Invoices page par us invoice ko open karke 'Record payment' dabayein.");
    bullet("Payment Mode", "Bank Transfer, UPI, Cheque, ya Cash select karein.");
    bullet("Partial Payment", "Agar kist (installment) me paisa aaya hai toh utna amount daalein. System bacha hua amount automatically Pending/Outstanding dikhayega.");
    bullet("Overpayment Guard", "System galti se bhi outstanding balance se zyada payment lene se rokta hai.");

    header("8. Rozana Ka Kaam: 1-Minute Cheatsheet");
    calloutBox("QUICK DAILY TASK SUMMARY", [
      "• Nayi Gaadi: Vehicles -> + Add -> Number, Type, aur 4 Permits (Insurance, PUC, Fitness, Advertising).",
      "• Rate Set: More -> Rate chart -> KM rate, City rate ya Monthly fixed rate save karein.",
      "• Nayi Trip: Trips -> + Adhoc trip -> Customer + Gaadi + Time + KM daal kar Calculate karein.",
      "• Approve: Trips me jaake Manager 'Approve trip' karega.",
      "• Bill Banana: Invoices -> + New invoice -> Dates select karein, trips tick karein, aur Issue karein.",
      "• Payment Lena: Invoice open karke 'Record payment' me amount aur UTR number daalein.",
      "• Expiry Check: Dashboard alerts me check karein kaunse documents expire hone wale hain."
    ]);

    doc.end();
    stream.on("finish", () => {
      console.log("PDF User guide written to:", pdfPath);
      resolve();
    });
    stream.on("error", reject);
  });
}

generatePdf().catch((e) => {
  console.error("PDF generation failed:", e);
  process.exit(1);
});
