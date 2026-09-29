#!/usr/bin/env node
import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const VERSION = "2026-09-23_v001";

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith("--") || argv[i + 1] === undefined) throw new Error(`Invalid argument near ${argv[i]}`);
    result[argv[i].slice(2)] = argv[i + 1];
  }
  for (const required of ["analysis-dir", "analysis-script", "readme", "output-xlsx", "manifest-path", "render-dir"]) {
    if (!result[required]) throw new Error(`Missing --${required}`);
  }
  return result;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift();
  return rows.filter((r) => r.some((v) => v !== "")).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

async function readCsv(filePath) { return parseCsv(await fs.readFile(filePath, "utf8")); }
function number(value) { return value === "" || value === null || value === undefined ? null : Number(value); }
function pDisplay(value) { const v = number(value); return v === null || Number.isNaN(v) ? "" : (v < 0.001 ? "<0.001" : v.toFixed(3)); }
function pct(value) { return `${(100 * number(value)).toFixed(2)}%`; }
function ciPct(lower, upper) { return `${pct(lower)} to ${pct(upper)}`; }
function ciRatio(lower, upper) { return `${number(lower).toFixed(2)} to ${number(upper).toFixed(2)}`; }
function medianIqr(median, iqr) { return `${number(median).toFixed(2)} (${number(iqr).toFixed(2)})`; }
function countPct(count, denominator) { return `${count}/${denominator} (${(100 * number(count) / denominator).toFixed(2)}%)`; }
function columnName(index) {
  let value = index + 1, name = "";
  while (value) { value--; name = String.fromCharCode(65 + (value % 26)) + name; value = Math.floor(value / 26); }
  return name;
}
async function sha256(filePath) { const data = await fs.readFile(filePath); return crypto.createHash("sha256").update(data).digest("hex"); }

const args = parseArgs(process.argv.slice(2));
const analysisDir = path.resolve(args["analysis-dir"]);
const analysisScript = path.resolve(args["analysis-script"]);
const readmePath = path.resolve(args.readme);
const outputPath = path.resolve(args["output-xlsx"]);
const manifestPath = path.resolve(args["manifest-path"]);
const renderDir = path.resolve(args["render-dir"]);
const builderPath = path.resolve(process.argv[1]);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.mkdir(path.dirname(manifestPath), { recursive: true });
await fs.mkdir(renderDir, { recursive: true });

const [cure, table1, table2, table3, table4, observedOnly, vasQc, reconciliation] = await Promise.all([
  "primary_cure.csv", "table1_baseline.csv", "table2_vas.csv", "table3_dlqi.csv", "table4_safety.csv",
  "vas_observed_only_sensitivity.csv", "vas_missingness_qc.csv", "reconciliation.csv",
].map((name) => readCsv(path.join(analysisDir, name))));
const metadata = JSON.parse(await fs.readFile(path.join(analysisDir, "analysis_metadata.json"), "utf8"));

const workbook = Workbook.create();
const NAVY = "#17365D", BLUE = "#4472C4", PALE = "#D9EAF7", LIGHT = "#F3F7FA", GRAY = "#666666", RED = "#FCE4D6", GREEN = "#E2F0D9";
const sheetsToRender = [];

function createSheet(name, title, subtitle, headers, rows, widths, tableName) {
  const sheet = workbook.worksheets.add(name);
  const lastCol = columnName(headers.length - 1);
  sheet.showGridLines = false;
  sheet.mergeCells(`A1:${lastCol}1`);
  sheet.mergeCells(`A2:${lastCol}2`);
  sheet.getRange("A1").values = [[title]];
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange("A1").format = { fill: NAVY, font: { name: "Arial", size: 14, bold: true, color: "#FFFFFF" }, verticalAlignment: "center" };
  sheet.getRange("A2").format = { fill: PALE, font: { name: "Arial", size: 9, color: "#1F1F1F" }, wrapText: true, verticalAlignment: "center" };
  sheet.getRange("A4").write([headers, ...rows]);
  sheet.tables.add(`A4:${lastCol}${rows.length + 4}`, true, tableName).style = "TableStyleMedium2";
  sheet.getRange(`A4:${lastCol}4`).format = { fill: BLUE, font: { name: "Arial", size: 9, bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true };
  sheet.getRange(`A5:${lastCol}${rows.length + 4}`).format = { font: { name: "Arial", size: 9, color: "#000000" }, verticalAlignment: "top", wrapText: true };
  sheet.getRange("1:1").format.rowHeight = 28;
  sheet.getRange("2:2").format.rowHeight = 34;
  sheet.getRange("4:4").format.rowHeight = 36;
  sheet.freezePanes.freezeRows(4);
  for (let i = 0; i < widths.length; i++) sheet.getRange(`${columnName(i)}:${columnName(i)}`).format.columnWidth = widths[i];
  sheet.tabColor = BLUE;
  sheetsToRender.push({ name, range: `A1:${lastCol}${rows.length + 4}` });
  return sheet;
}

const cureRows = cure.map((r) => {
  let estimate = "", ci = "";
  if (r.Section === "Group rate" || r.Measure.startsWith("Risk difference")) { estimate = pct(r.Estimate); ci = ciPct(r.CI_Lower, r.CI_Upper); }
  else if (r.Section === "Effect") { estimate = number(r.Estimate).toFixed(2); ci = ciRatio(r.CI_Lower, r.CI_Upper); }
  return [r.Section, r.Measure, r.Numerator && r.Denominator ? `${r.Numerator}/${r.Denominator}` : "", estimate, ci, r.Statistic ? number(r.Statistic).toFixed(3) : "", pDisplay(r.P_Value), r.Method, r.Interpretation];
});
const primary = createSheet("Primary Cure", "Primary Day-7 Cure Analysis", "All 106 randomized participants; two-sided uncorrected Pearson chi-square is primary. Effect direction is Experimental versus Control.", ["Section", "Measure", "n/N", "Estimate", "95% CI", "Statistic", "P value", "Method", "Interpretation"], cureRows, [15, 38, 12, 14, 23, 12, 12, 31, 28], "PrimaryCureResults");
primary.getRange("A5:A13").format.font = { name: "Arial", size: 9, bold: true, color: NAVY };
primary.getRange("A10:I10").format.fill = GREEN;

const table1Rows = table1.map((r) => [r.Variable, r.Level, r.Total_Summary, r.Control_Summary, r.Experimental_Summary, r.Test, r.Statistic ? number(r.Statistic).toFixed(3) : "", pDisplay(r.P_Value), r.Published_P, r.Assessment]);
const baseline = createSheet("Table 1 Baseline", "Table 1 — Baseline Characteristics", "Age is mean ± SD; categorical values are n (%); other continuous values are median (IQR).", ["Variable", "Level", "Total (N=106)", "Control (N=52)", "Experimental (N=54)", "Test", "Statistic", "P value", "Published P", "Assessment"], table1Rows, [25, 13, 20, 20, 22, 31, 12, 12, 12, 29], "Table1Baseline");
baseline.getRange("A6:J6").format.fill = RED;

function vasRows(rows) { return rows.map((r) => [r.Day, `${r.Total_n}; ${medianIqr(r.Total_Median, r.Total_IQR)}`, `${r.Control_n}; ${medianIqr(r.Control_Median, r.Control_IQR)}`, `${r.Experimental_n}; ${medianIqr(r.Experimental_Median, r.Experimental_IQR)}`, number(r.U_Statistic).toFixed(3), r.P_Display, r.Published_P, r.Assessment]); }
createSheet("Table 2 VAS", "Table 2 — VAS Pain Scores", "Strict replication. Cells show n; median (IQR). Days 4–7 incorporate only confirmed post-cure structural zeros; day 28 is observed-only.", ["Day", "Total", "Control", "Experimental", "U statistic", "P value", "Published P", "Assessment"], vasRows(table2), [10, 23, 23, 23, 14, 12, 12, 29], "Table2VAS");

const table3Rows = table3.map((r) => [r.Time, `${r.Total_n}; ${medianIqr(r.Total_Median, r.Total_IQR)}`, `${r.Control_n}; ${medianIqr(r.Control_Median, r.Control_IQR)}`, `${r.Experimental_n}; ${medianIqr(r.Experimental_Median, r.Experimental_IQR)}`, number(r.U_Statistic).toFixed(3), r.P_Display, r.Published_P, r.Assessment]);
const dlqi = createSheet("Table 3 DLQI", "Table 3 — DLQI Scores", "Cells show n; median (IQR). Change is admission minus hospital discharge.", ["Time", "Total", "Control", "Experimental", "U statistic", "P value", "Published P", "Assessment"], table3Rows, [29, 23, 23, 23, 14, 12, 12, 48], "Table3DLQI");
dlqi.getRange("A5:H5").format.fill = RED;
dlqi.getRange("A7:H7").format.fill = RED;

const table4Rows = table4.map((r) => {
  const minExpected = number(r.Minimum_Expected);
  const fisher = minExpected !== null && minExpected < 5 ? pDisplay(r.Fisher_P) : "";
  return [r.Side_Effect, countPct(r.Total_Events, 106), countPct(r.Control_Events, 52), countPct(r.Experimental_Events, 54), r.Pearson_ChiSquare ? number(r.Pearson_ChiSquare).toFixed(3) : "", pDisplay(r.Pearson_P), fisher, r.Published_P, `${r.Published_Control_Events}/${r.Published_Experimental_Events}`, r.Assessment];
});
const safety = createSheet("Table 4 Safety", "Table 4 — Safety Events", "Pearson tests are uncorrected. Two-sided Fisher sensitivity is displayed only when an expected cell count is below 5. All-zero rows have no p-value.", ["Side effect", "Total", "Control", "Experimental", "Pearson χ²", "Pearson P", "Fisher P", "Published P", "Published C/E", "Assessment"], table4Rows, [32, 20, 20, 20, 14, 12, 12, 12, 15, 37], "Table4Safety");
safety.getRange("A5:J9").format.fill = RED;

createSheet("Observed Only", "Observed-Only VAS Sensitivity", "No structural zeros are derived. This sensitivity analysis is not the strict source-replication analysis.", ["Day", "Total", "Control", "Experimental", "U statistic", "P value", "Published P", "Assessment"], vasRows(observedOnly), [10, 23, 23, 23, 14, 12, 12, 43], "ObservedOnlyVAS");

const qcRows = vasQc.map((r) => [number(r.Day), r.Group, number(r.Randomized_N), number(r.Observed_N), number(r.Source_Missing_N), number(r.Derived_Structural_Zero_N), number(r.Unresolved_Missing_N), number(r.Analysis_N)]);
createSheet("VAS QC", "VAS Missingness and Structural-Zero Audit", "Derived zeros occur only after an earlier observed VAS=0 on days 1–7. Source values remain unchanged in the deidentified working workbook.", ["Day", "Group", "Randomized N", "Observed N", "Source missing N", "Derived zero N", "Unresolved missing N", "Analysis N"], qcRows, [10, 18, 16, 15, 19, 18, 21, 15], "VASMissingnessQC");

const reconciliationRows = reconciliation.map((r) => [r.ID, r.Location, r.Item, r.Published, r.Replicated, r.Assessment, r.Explanation]);
const recon = createSheet("Reconciliation", "Publication-to-Source Reconciliation", "Exact and rounding-compatible findings are distinguished from unresolved source/publication discrepancies.", ["ID", "Location", "Item", "Published", "Replicated", "Assessment", "Explanation"], reconciliationRows, [11, 22, 33, 42, 42, 31, 68], "PublicationReconciliation");
for (let i = 0; i < reconciliation.length; i++) if (reconciliation[i].Assessment.toLowerCase().includes("unresolved") || reconciliation[i].Assessment.includes("not reproduced")) recon.getRange(`A${i + 5}:G${i + 5}`).format.fill = RED;

const methodRows = [
  ["Analysis version", VERSION],
  ["Created UTC", metadata.created_utc],
  ["Input", metadata.input.filename],
  ["Input SHA-256", metadata.input.sha256],
  ["Analysis population", "All 106 randomized participants (52 control; 54 experimental)"],
  ["Primary cure test", "Two-sided uncorrected Pearson chi-square; alpha=0.05"],
  ["Cure definition", "VAS=0 at day 7 after applying the confirmed post-cure structural-zero rule"],
  ["Rate confidence intervals", "Wilson 95%"],
  ["Risk-difference confidence interval", "Newcombe hybrid-score 95%, Experimental - Control"],
  ["Risk-ratio confidence interval", "Katz log 95%, Experimental / Control"],
  ["Odds-ratio confidence interval", "Woolf log 95%, Experimental / Control"],
  ["Quartiles", "SPSS EXAMINE HAVERAGE, rank=(n+1)p"],
  ["Mann-Whitney", "Two-sided asymptotic, tie-corrected, no continuity correction"],
  ["Age comparison", "Pooled equal-variance two-sample t-test"],
  ["Safety", "Uncorrected Pearson; Fisher sensitivity when any expected count <5; no p-value for all-zero rows"],
  ["Multiplicity", "No adjustment; secondary p-values are descriptive"],
  ["Software", `Python ${metadata.software.python}; NumPy ${metadata.software.numpy}; SciPy ${metadata.software.scipy}`],
  ["Data handling", "Results workbook contains aggregate outputs only; no participant-level data are included"],
];
const methods = createSheet("Methods", "Locked Analysis Methods and Provenance", "Methods are taken from the installed source-replication analysis specification and decision log.", ["Item", "Value"], methodRows, [40, 112], "MethodsAndProvenance");
methods.getRange("B6").setNumberFormat('yyyy-mm-dd hh:mm:ss "UTC"');

workbook.recalculate();
const inspections = {};
for (const item of sheetsToRender) {
  const preview = await workbook.render({ sheetName: item.name, range: item.range, scale: 1.0, format: "png" });
  const fileName = `${item.name.replaceAll(" ", "_")}.png`;
  await fs.writeFile(path.join(renderDir, fileName), new Uint8Array(await preview.arrayBuffer()));
  const inspected = await workbook.inspect({ kind: "table", range: `${item.name}!${item.range}`, include: "values,formulas", tableMaxRows: 8, tableMaxCols: 12, maxChars: 12000 });
  inspections[item.name] = inspected.ndjson;
}
const formulaErrors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 300 }, summary: "final formula error scan" });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const artifacts = [
  analysisScript, builderPath, readmePath, outputPath,
  ...["primary_cure.csv", "table1_baseline.csv", "table2_vas.csv", "table3_dlqi.csv", "table4_safety.csv", "vas_observed_only_sensitivity.csv", "vas_missingness_qc.csv", "reconciliation.csv", "analysis_metadata.json"].map((name) => path.join(analysisDir, name)),
];
const manifestRows = [];
for (const filePath of artifacts) manifestRows.push([path.basename(filePath), await sha256(filePath), (await fs.stat(filePath)).size, filePath === outputPath ? "Result workbook" : filePath === analysisScript ? "Analysis script" : filePath === builderPath ? "Workbook builder" : filePath === readmePath ? "Package README" : "Machine-readable analysis output", metadata.created_utc]);
const tsv = [["File_Name", "SHA256", "Size_Bytes", "Role", "Run_UTC"], ...manifestRows].map((row) => row.join("\t")).join("\n") + "\n";
await fs.writeFile(manifestPath, tsv, "utf8");
await fs.writeFile(path.join(renderDir, "workbook_validation.json"), JSON.stringify({ outputPath, manifestPath, sheets: sheetsToRender, inspections, formulaErrorScan: formulaErrors.ndjson }, null, 2) + "\n");
console.log(JSON.stringify({ outputPath, manifestPath, sheetCount: sheetsToRender.length, formulaErrorScan: formulaErrors.ndjson }, null, 2));
