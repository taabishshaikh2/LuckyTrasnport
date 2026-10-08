import { z } from "zod";
import { ShiftSettings } from "../models/index.js";
export const defaultShifts=[{hours:8,monthlyKm:3000},{hours:16,monthlyKm:4000},{hours:24,monthlyKm:5000}];
export const shiftSettingsSchema=z.object({entries:z.array(z.object({hours:z.coerce.number().positive().max(168),monthlyKm:z.coerce.number().positive().max(1e9)})).min(1).max(30).refine(v=>new Set(v.map(s=>s.hours)).size===v.length,"Each shift must have different hours")});
export async function getShiftSettings(session) {
  return await ShiftSettings.findById("shifts").session(session || null).lean() || {_id:"shifts",entries:defaultShifts};
}
