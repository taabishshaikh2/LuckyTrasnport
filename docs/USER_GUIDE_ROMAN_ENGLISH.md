# Lucky Transport Services — Aasan Bhasha Me App User Guide (Roman English)

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

```
[1. Customer Add Karo] ──┐
                         ├───> [4. Trip / Duty Banao] ───> [5. Trip Approve Karo] ───> [6. Invoice / Bill] ───> [7. Payment Record]
[2. Vehicle Add Karo]  ──┤              ▲
                         │              │
[3. Rate Chart Set Karo] ─┴──────────────┘
```

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
1. **Vehicle number:** Gaadi ka number daalein (jaise: `MH02ER6375` ya `MH02GS1735`).
2. **Vehicle type:** Gaadi ka size chunein (jaise: `8 FT`, `9 FT`, `14 FT`, `17 FT`, `20 FT`, wagera).
3. **Branded vehicle checkbox:**
   - Agar gaadi kisi company (jaise DHL) me monthly fixed contract par chalti hai, toh **Branded vehicle** check karein.
   - Agar gaadi normal adhoc / daily trip par chalti hai, toh ise unchecked rehne dein.
4. **Assigned Shift:** Branded gaadi ke liye shift select karein (jaise: `8 hours - 3000 KM`).
5. **Chaar (4) Compliance Permits (Document Expiry Checks):**
   - **Valid insurance:** Checkbox tick karein aur Insurance Expiry Date daalein.
   - **Valid PUC:** Checkbox tick karein aur PUC Expiry Date daalein.
   - **Valid fitness permit:** Checkbox tick karein aur Fitness Expiry Date daalein.
   - **Valid advertising permit:** Checkbox tick karein aur Advertising Expiry Date daalein.

> **Tip:** Agar kisi document ka checkbox tick karenge toh date daalna zaroori hai. Jab bhi kisi document ki expiry me 7 din bachenge, system dashboard par laal warning alert dikhayega aur automatically email reminder bhejega.

---

## 4. Step 2: Rate Chart Kaise Set Karein?

Rate Chart set karne ke liye **More $\rightarrow$ Rate chart** par jayein.

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
- Branded gaadiyon ke liye Customer chunein (jaise TEST DHL), Site `Branded`, Vehicle type (jaise 17 FT), Shift hours (8 hours - 3000 KM), aur Fixed rate per KM daalein.
- **Important:** "Valid from" date ko hamesha us mahine ki 1 tareekh ya usse pehle ka rakhein jis mahine ka bill banana hai!

---

## 5. Step 3: Trip Kaise Add Karein (Adhoc & Special Trips)

Trip add karne ke liye **Trips $\rightarrow$ '+ Adhoc trip'** par click karein.

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

Invoice banane ke liye **Invoices $\rightarrow$ '+ New invoice'** par click karein.

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
| Nayi Gaadi Add Karna | Vehicles $\rightarrow$ + Add | Number, Type, aur 4 Permits (Insurance, PUC, Fitness, Advertising) expiry dates ke sath daalein. |
| Naya Rate Set Karna | More $\rightarrow$ Rate chart | KM rate, City rate ya Monthly fixed rate save karein. |
| Nayi Trip Dalna | Trips $\rightarrow$ + Adhoc trip | Customer + Gaadi + Time + KM daal kar 'Calculate & review' karein aur save karein. |
| Trip Approve Karna | Trips $\rightarrow$ Trip open karein | 'Approve trip' click karein. |
| Bill / Invoice Banana | Invoices $\rightarrow$ + New invoice | Customer + Dates select karke trips tick karein aur 'Issue invoice' karein. |
| Payment Dalna | Invoices $\rightarrow$ Invoice open | 'Record payment' karke amount aur UTR number daalein. |
| Expiry Check Karna | Home Dashboard | Dashboard alerts check karein kaunse documents expire hone wale hain. |
