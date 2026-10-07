# Bulk trips — implementation and pending decisions

Confirmed: one worksheet row is one challan/trip. Billable duty starts at pickup arrival. All supplied trip-sheet columns are retained in the form, detail/list and XLSX import/export.

Implemented foundation: table-header detection, mixed vehicles, date-specific configured rates, independent draft calculations, optional draft driver, per-row warnings, duplicate checks across files, atomic confirmation with a preview token, full-column template and exports. Opening Time represents pickup arrival; explicit closing dates support multi-day trips. Without a closing date, an earlier closing clock is interpreted as next day and flagged. Duration format is explicitly selected (hours.minutes, decimal hours, or Excel duration). No invoices are automatically created.

Pending owner answers: overtime rounding, VVR six-hour allowance and O.T. IN KM meaning, billing groups and monthly-pass assignment. Source fields stay separate from calculated amounts. Existing rate configuration and two-decimal currency rounding remain provisional. Monthly passes are not added per imported trip. The fleet-contract pages describe a separate monthly deployment model; inclusion needs confirmation before implementing it. Existing historical trips and finalized invoice snapshots are not rewritten.

Next after answers: configure effective-dated rates, implement confirmed overtime/night/PNQ rules, billing-group monthly-pass allocation and matching printed invoice summaries. Historical rate documents must be entered with their effective dates rather than replacing newer rates.
