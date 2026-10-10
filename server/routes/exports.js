import {getShiftSettings} from "../services/shiftSettingsService.js";
import XLSX from "xlsx-js-style";
import {brandedHeaders} from "../services/brandedImportService.js";
import { getCompanyProfile } from "../services/companyProfileService.js";
import { Router } from "express";
import { Trip, Invoice, BrandedLog,WeeklyOff,Vehicle,FleetRate,FuelCharge } from "../models/index.js";
import { operations } from "../middleware/auth.js";
import { id } from "../validators/index.js";
import {
  adhocWorkbook, brandedWorkbook, tripWorkbook,
  importTemplate, siteWorkbook, allSitesWorkbook,
} from "../services/excelExportService.js";
import { tripDocx, invoiceDocx } from "../services/docxService.js";
import { invoicePdf } from "../services/pdfService.js";
import { invoiceBalance } from "../services/paymentService.js";
import { wrap, AppError } from "../utils/errors.js";
const r = Router();
r.use(operations);
const types = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};
const send = (res, buffer, name, ext) =>
  res
    .set({
      "Content-Type": types[ext],
      "Content-Disposition":
        'attachment; filename="' +
        name.replace(/[^a-zA-Z0-9_-]/g, "-") +
        "." +
        ext +
        '"',
    })
    .send(buffer);
r.get("/branded-log-template.xlsx",wrap(async(req,res)=>{
 const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet([brandedHeaders]);ws['!cols']=brandedHeaders.map(()=>({wch:22}));
 for(const cell of Object.values(ws))if(cell&&typeof cell==='object'&&'v' in cell)cell.s={font:{bold:true},alignment:{wrapText:true}};
 XLSX.utils.book_append_sheet(wb,ws,"Branded logs");send(res,XLSX.write(wb,{type:"buffer",bookType:"xlsx"}),"branded-log-template","xlsx");
}));
r.get("/branded-logs.xlsx",wrap(async(req,res)=>{
 const month=String(req.query.month||"");if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new AppError("Select a log month");
 const from=new Date(month+"-01"),to=new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth()+1,1));
 const filter={archived:false,date:{$gte:from,$lt:to},...(req.query.vehicleId?{vehicleId:id.parse(req.query.vehicleId)}:{})};
 const logs=await BrandedLog.find(filter).sort({date:1,openingTime:1}).lean();if(!logs.length)throw new AppError("No branded logs match the selected month",404);
 const vehicles=await Vehicle.find({_id:{$in:logs.map(l=>l.vehicleId)}}).lean(),offs=await WeeklyOff.find(filter).lean();
 const [company,shifts,rates,fuels]=await Promise.all([getCompanyProfile(),getShiftSettings(),FleetRate.find({archived:false,active:true,customerId:{$in:logs.map(l=>l.customerId)}}).lean(),FuelCharge.find({archived:false,vehicleId:{$in:logs.map(l=>l.vehicleId)}}).lean()]);
 send(res,brandedWorkbook(logs,vehicles,offs,{company,shifts:shifts.entries,rates,fuels}),"branded-shift-log","xlsx");
}));
r.get(
  "/import-template.xlsx",
  wrap(async (req, res) =>
    send(res, importTemplate(req.query.site), "trip-import-template", "xlsx"),
  ),
);
r.get(
  "/trips.xlsx",
  wrap(async (req, res) => {
    const filter = {};
    if (req.query.site) filter.site=String(req.query.site);
    for (const key of ["customerId", "vehicleId", "routeId"])
      if (req.query[key]) filter[key] = id.parse(req.query[key]);
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.tripId) filter._id = id.parse(req.query.tripId);
    if (req.query.invoiceId) {
      const i = await Invoice.findById(id.parse(req.query.invoiceId));
      if (!i) throw new AppError("Invoice not found", 404);
      if (i.tripSnapshot?.length || i.narration?.vehicles?.length) {
        const branded=i.narration?.vehicles?.filter(v=>v.metrics?.logs?.length);
      if(branded?.length){
        const logs=branded.flatMap(v=>v.metrics.logs),vehicles=branded.map(v=>({_id:v.vehicleId,vehicleNumber:v.vehicleNumber,shiftHours:v.agreement.shiftHours,adcRate:v.agreement.serviceRate,includedHours:v.metrics.includedHours,vehicleType:v.agreement.vehicleType,amcRate:v.agreement.amcRate,snapshot:v})),offs=branded.flatMap(v=>(v.sources||[]).filter(s=>s.model==="WeeklyOff").map(s=>s.record));
        return send(res,brandedWorkbook(logs,vehicles,offs,{company:i.companySnapshot,invoice:i}),i.invoiceNumber+"-branded-log","xlsx");
      }
      const profile=i.site;
        return send(res,profile ? siteWorkbook(i.tripSnapshot || [],profile,i) : await tripWorkbook(i.tripSnapshot || []),i.invoiceNumber + "-supporting","xlsx");
      }
      filter._id = { $in: i.tripIds };
    }
    if (req.query.from || req.query.to)
      filter.periodFrom = {
        ...(req.query.from ? { $gte: new Date(req.query.from) } : {}),
        ...(req.query.to ? { $lte: new Date(req.query.to) } : {}),
      };
    const trips = await Trip.find(filter)
      .populate("customerId", "companyName")
      .sort({ periodFrom: 1 })
      .limit(2000);
    if (!trips.length)
      throw new AppError(
        "No trips match the selected filters. Create or import trips before exporting.",
        404,
      );
    const company = await getCompanyProfile();
    send(res, trips.some(t=>t.adhocService) ? adhocWorkbook(trips,req.query.site,company,{from:req.query.from,to:req.query.to}) : req.query.site ? siteWorkbook(trips,String(req.query.site),undefined,company) : trips.some(t=>t.site) ? await allSitesWorkbook(trips,company) : await tripWorkbook(trips), "lucky-trip-sheet", "xlsx");
  }),
);
r.get(
  "/trips/:id.docx",
  wrap(async (req, res) => {
    const t = await Trip.findById(id.parse(req.params.id));
    if (!t) throw new AppError("Trip not found", 404);
    send(res, await tripDocx(t), t.tripId, "docx");
  }),
);
r.get(
  "/invoices/:id.:format",
  wrap(async (req, res) => {
    if (!["pdf", "docx"].includes(req.params.format))
      throw new AppError("Unsupported format");
    const i = await Invoice.findById(id.parse(req.params.id));
    if (!i) throw new AppError("Invoice not found", 404);
    const section=String(req.query.section || "all");
    if (!["all","invoice","narration"].includes(section)) throw new AppError("Unsupported PDF section");
    if (section!=="all" && (req.params.format!=="pdf" || !["Fixed","Variable"].includes(i.billingType))) throw new AppError("Separate PDF sections are available for Fixed and Variable invoices");
    const b = await invoiceBalance(i);
    send(
      res,
      req.params.format === "pdf"
        ? await invoicePdf(i, b, section)
        : await invoiceDocx(i, b),
      i.invoiceNumber+(section==="narration"?"-narration":""),
      req.params.format,
    );
  }),
);
export default r;
