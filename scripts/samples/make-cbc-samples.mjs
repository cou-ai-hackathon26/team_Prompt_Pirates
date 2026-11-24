/**
 * Generates SYNTHETIC CBC lab reports for testing and the hackathon demo.
 * All lab names, people and values are fictional and every report is stamped "SAMPLE".
 *
 *   node scripts/samples/make-cbc-samples.mjs
 *
 * Output: public/samples/cbc/<id>.png (clean scan), <id>-photo.png (phone-photo look), <id>.pdf (print)
 *         public/samples/cbc/index.json (expected values, used by the validation script)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const OUT = resolve("public/samples/cbc");
const TMP = resolve("scripts/samples/.tmp");
const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => existsSync(p));
if (!CHROME) throw new Error("Chrome or Edge not found");

mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const SAMPLE_NOTE =
  "SAMPLE REPORT · FOR DEMONSTRATION ONLY · নমুনা রিপোর্ট, বাস্তব নয় · Fictional lab, patient and values";

/* ----------------------------- report data ----------------------------- */
// `expected` = what the app should end up with after normalisation (per microlitre).
const reports = [
  {
    id: "demo-day2-shapla",
    title: "Demo patient, fever day 2 (normal)",
    layout: "classic",
    lab: { name: "Shapla Demo Diagnostic Centre", bn: "শাপলা ডেমো ডায়াগনস্টিক সেন্টার", addr: "Maijdee Court, Noakhali (fictional)", color: "#0f766e" },
    patient: { name: "Rahim Uddin (DEMO)", age: "9 Y", sex: "Male", id: "SD-26-11-0412", ref: "Dr. A. Karim (fictional)" },
    date: "2026-11-20",
    rows: [
      ["Haemoglobin", "12.8", "g/dL", "11.5 - 15.5"],
      ["Total WBC Count", "4,200", "/cumm", "4,000 - 11,000"],
      ["Platelet Count", "1,60,000", "/cumm", "1,50,000 - 4,50,000"],
      ["Haematocrit (HCT/PCV)", "38", "%", "35 - 45"],
      ["RBC Count", "4.6", "million/cumm", "4.0 - 5.2"],
      ["ESR (Westergren)", "18", "mm/1st hr", "0 - 10"],
    ],
    expected: { plateletUl: 160000, hctPct: 38, wbcUl: 4200, hbGdl: 12.8 },
  },
  {
    id: "demo-day4-shapla",
    title: "Demo patient, fever day 4 (platelets 45k, HCT up 21%: RED)",
    layout: "classic",
    lab: { name: "Shapla Demo Diagnostic Centre", bn: "শাপলা ডেমো ডায়াগনস্টিক সেন্টার", addr: "Maijdee Court, Noakhali (fictional)", color: "#0f766e" },
    patient: { name: "Rahim Uddin (DEMO)", age: "9 Y", sex: "Male", id: "SD-26-11-0588", ref: "Dr. A. Karim (fictional)" },
    date: "2026-11-22",
    rows: [
      ["Haemoglobin", "14.6", "g/dL", "11.5 - 15.5"],
      ["Total WBC Count", "3,100", "/cumm", "4,000 - 11,000", "L"],
      ["Platelet Count", "45,000", "/cumm", "1,50,000 - 4,50,000", "L"],
      ["Haematocrit (HCT/PCV)", "46", "%", "35 - 45", "H"],
      ["RBC Count", "5.1", "million/cumm", "4.0 - 5.2"],
      ["ESR (Westergren)", "12", "mm/1st hr", "0 - 10"],
    ],
    expected: { plateletUl: 45000, hctPct: 46, wbcUl: 3100, hbGdl: 14.6 },
  },
  {
    id: "meghna-analyzer-si",
    title: "Analyzer printout, x10^3/µL units (platelets 85k: YELLOW)",
    layout: "analyzer",
    lab: { name: "Meghna Demo Pathology & Imaging", bn: "মেঘনা ডেমো প্যাথলজি", addr: "Station Road, Chattogram (fictional)", color: "#1d4ed8" },
    patient: { name: "Nasrin Akter (DEMO)", age: "31 Y", sex: "Female", id: "MP/2611/7781", ref: "Self" },
    date: "2026-11-21",
    rows: [
      ["WBC", "3.8", "x10^3/µL", "4.0 - 10.0", "L"],
      ["RBC", "4.52", "x10^6/µL", "3.80 - 5.20"],
      ["HGB", "12.9", "g/dL", "12.0 - 15.0"],
      ["HCT", "42.1", "%", "36.0 - 46.0"],
      ["MCV", "93.1", "fL", "80 - 100"],
      ["MCH", "28.5", "pg", "27 - 32"],
      ["PLT", "85", "x10^3/µL", "150 - 410", "L"],
      ["MPV", "10.9", "fL", "7.5 - 11.5"],
    ],
    expected: { plateletUl: 85000, hctPct: 42.1, wbcUl: 3800, hbGdl: 12.9 },
  },
  {
    id: "padma-compact-kul",
    title: "Compact slip, K/uL units (normal)",
    layout: "slip",
    lab: { name: "Padma Demo Clinical Lab", bn: "পদ্মা ডেমো ক্লিনিক্যাল ল্যাব", addr: "Mirpur-10, Dhaka (fictional)", color: "#7c3aed" },
    patient: { name: "Kamal Hossain (DEMO)", age: "45 Y", sex: "M", id: "PCL-55120", ref: "OPD" },
    date: "2026-11-19",
    rows: [
      ["WBC", "6.4", "K/uL", "4.5-11.0"],
      ["HGB", "14.1", "g/dL", "13.5-17.5"],
      ["HCT", "40.0", "%", "41-53", "L"],
      ["PLT", "210", "K/uL", "150-400"],
    ],
    expected: { plateletUl: 210000, hctPct: 40, wbcUl: 6400, hbGdl: 14.1 },
  },
  {
    id: "jamuna-si-10e9",
    title: "Hospital lab, x10^9/L units with flags (platelets 32k: RED)",
    layout: "hospital",
    lab: { name: "Jamuna Demo General Hospital Laboratory", bn: "যমুনা ডেমো জেনারেল হাসপাতাল", addr: "Kandirpar, Cumilla (fictional)", color: "#b91c1c" },
    patient: { name: "Sumaiya (DEMO)", age: "16 Y", sex: "F", id: "IPD-2611-0093 / Bed 12", ref: "Medicine Unit-2" },
    date: "2026-11-22",
    rows: [
      ["Haemoglobin (Hb)", "15.2", "g/dL", "12.0 - 16.0"],
      ["Packed Cell Volume (PCV)", "49", "%", "36 - 46", "H"],
      ["Total Leucocyte Count", "2.9", "x10^9/L", "4.0 - 11.0", "L"],
      ["Neutrophils", "48", "%", "40 - 75"],
      ["Lymphocytes", "44", "%", "20 - 45"],
      ["Platelets", "32", "x10^9/L", "150 - 450", "L"],
    ],
    expected: { plateletUl: 32000, hctPct: 49, wbcUl: 2900, hbGdl: 15.2 },
  },
  {
    id: "karnaphuli-range-trap",
    title: "Result printed after the reference range (tests column reading; platelets 1.2 lakh)",
    layout: "rangefirst",
    lab: { name: "Karnaphuli Demo Diagnostics", bn: "কর্ণফুলী ডেমো ডায়াগনস্টিকস", addr: "Uttara Sector 7, Dhaka (fictional)", color: "#c2410c" },
    patient: { name: "Abdul Malek (DEMO)", age: "68 Y", sex: "Male", id: "KD-889214", ref: "Dr. S. Rahman (fictional)" },
    date: "2026-11-21",
    rows: [
      ["Hemoglobin", "13.2", "gm/dl", "13.0 - 17.0"],
      ["Total Count of WBC", "5,600", "/µL", "4,000 - 11,000"],
      ["Platelet Count", "1,20,000", "/µL", "1,50,000 - 4,50,000", "L"],
      ["Hematocrit", "44", "%", "40 - 50"],
    ],
    expected: { plateletUl: 120000, hctPct: 44, wbcUl: 5600, hbGdl: 13.2 },
  },
  {
    id: "not-cbc-ns1",
    title: "Dengue NS1 antigen report (NOT a CBC: app should say so)",
    layout: "serology",
    lab: { name: "Shapla Demo Diagnostic Centre", bn: "শাপলা ডেমো ডায়াগনস্টিক সেন্টার", addr: "Maijdee Court, Noakhali (fictional)", color: "#0f766e" },
    patient: { name: "Rahim Uddin (DEMO)", age: "9 Y", sex: "Male", id: "SD-26-11-0411", ref: "Dr. A. Karim (fictional)" },
    date: "2026-11-20",
    rows: [
      ["Dengue NS1 Antigen", "POSITIVE", "", "Negative"],
      ["Dengue IgM Antibody", "Negative", "", "Negative"],
      ["Dengue IgG Antibody", "Negative", "", "Negative"],
    ],
    expected: { isCbcReport: false },
  },
];

/* ------------------------------- layouts ------------------------------- */
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const fmtDate = (iso, style) => {
  const [y, m, d] = iso.split("-");
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1];
  return style === "slash" ? `${d}/${m}/${y}` : `${d}-${mon}-${y}`;
};

const baseCss = `
  @page { size: A4; margin: 0 }
  * { box-sizing: border-box }
  body { margin: 0; font-family: "Segoe UI", Arial, "Nirmala UI", sans-serif; color: #111; background: #fff }
  .page { width: 1240px; min-height: 1754px; padding: 70px 80px 120px; position: relative; overflow: hidden }
  .wm { position: absolute; top: 46%; left: -10%; width: 120%; text-align: center; transform: rotate(-28deg);
        font-size: 150px; font-weight: 800; color: rgba(220,38,38,.07); letter-spacing: 20px; pointer-events: none }
  .foot { position: absolute; left: 80px; right: 80px; bottom: 50px; border-top: 2px dashed #dc2626; padding-top: 14px;
          color: #b91c1c; font-size: 20px; font-weight: 600; text-align: center }
  table { border-collapse: collapse; width: 100% }
`;

function header(r, extra = "") {
  return `
  <div style="display:flex;align-items:center;gap:26px;border-bottom:5px solid ${r.lab.color};padding-bottom:20px">
    <div style="width:110px;height:110px;border-radius:50%;background:${r.lab.color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:44px;font-weight:800">${r.lab.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
    <div style="flex:1">
      <div style="font-size:42px;font-weight:800;color:${r.lab.color}">${esc(r.lab.name)}</div>
      <div style="font-size:30px;font-weight:600">${esc(r.lab.bn)}</div>
      <div style="font-size:22px;color:#444">${esc(r.lab.addr)} · Hotline: 01XXX-XXXXXX</div>
    </div>
    ${extra}
  </div>`;
}

function patientBox(r, dateStyle) {
  const p = r.patient;
  return `
  <table style="margin:26px 0;font-size:24px">
    <tr><td style="padding:6px 0;width:20%"><b>Patient Name</b></td><td>: ${esc(p.name)}</td><td style="width:18%"><b>Patient ID</b></td><td>: ${esc(p.id)}</td></tr>
    <tr><td style="padding:6px 0"><b>Age / Sex</b></td><td>: ${esc(p.age)} / ${esc(p.sex)}</td><td><b>Report Date</b></td><td>: ${fmtDate(r.date, dateStyle)}</td></tr>
    <tr><td style="padding:6px 0"><b>Referred By</b></td><td colspan="3">: ${esc(p.ref)}</td></tr>
  </table>`;
}

const flag = (f) => (f ? `<b style="color:#b91c1c">${f}</b>` : "");

const layouts = {
  classic: (r) => `
    ${header(r)}
    ${patientBox(r)}
    <div style="text-align:center;font-size:32px;font-weight:800;text-decoration:underline;margin:10px 0 18px">HAEMATOLOGY REPORT<br><span style="font-size:24px;font-weight:600">Complete Blood Count (CBC)</span></div>
    <table style="font-size:26px">
      <tr style="background:#f1f5f9"><th style="text-align:left;padding:12px">Test Name</th><th style="text-align:left">Result</th><th style="text-align:left">Unit</th><th style="text-align:left">Reference Value</th></tr>
      ${r.rows.map((x) => `<tr style="border-bottom:1px solid #e2e8f0"><td style="padding:14px 12px">${esc(x[0])}</td><td><b>${esc(x[1])}</b> ${flag(x[4])}</td><td>${esc(x[2])}</td><td>${esc(x[3])}</td></tr>`).join("")}
    </table>
    <p style="font-size:22px;margin-top:30px"><b>Comment:</b> Please correlate clinically.</p>
    <div style="display:flex;justify-content:space-between;margin-top:120px;font-size:22px">
      <div>____________________<br>Lab Technologist</div>
      <div style="text-align:right">____________________<br>Consultant Pathologist (fictional)</div>
    </div>`,

  analyzer: (r) => `
    ${header(r, `<div style="font-size:20px;text-align:right">Sample: EDTA Blood<br>Analyzer: 5-Part Hematology</div>`)}
    ${patientBox(r, "slash")}
    <div style="font-size:30px;font-weight:700;background:${r.lab.color};color:#fff;padding:10px 16px;margin:10px 0">COMPLETE BLOOD COUNT</div>
    <table style="font-size:25px;font-family:Consolas,monospace">
      <tr style="border-bottom:2px solid #111"><th style="text-align:left;padding:10px">Parameter</th><th style="text-align:right">Result</th><th style="text-align:left;padding-left:20px">Flag</th><th style="text-align:left">Units</th><th style="text-align:left">Ref. Range</th></tr>
      ${r.rows.map((x) => `<tr><td style="padding:10px">${esc(x[0])}</td><td style="text-align:right"><b>${esc(x[1])}</b></td><td style="padding-left:20px">${flag(x[4])}</td><td>${esc(x[2])}</td><td>${esc(x[3])}</td></tr>`).join("")}
    </table>
    <p style="font-size:21px;margin-top:40px;color:#333">Results verified by: Senior Medical Technologist (fictional). Printed by LIS.</p>`,

  slip: (r) => `
    <div style="width:760px;margin:0 auto;border:2px solid #333;padding:30px 36px;font-family:Consolas,'Courier New',monospace">
      <div style="text-align:center;font-size:30px;font-weight:800">${esc(r.lab.name.toUpperCase())}</div>
      <div style="text-align:center;font-size:20px">${esc(r.lab.addr)}</div>
      <hr style="border:0;border-top:2px dashed #333">
      <div style="font-size:21px;line-height:1.6">NAME: ${esc(r.patient.name)}<br>AGE/SEX: ${esc(r.patient.age)}/${esc(r.patient.sex)}   ID: ${esc(r.patient.id)}<br>DATE: ${fmtDate(r.date, "slash")} 10:42</div>
      <hr style="border:0;border-top:2px dashed #333">
      <div style="font-size:24px;font-weight:700;margin:8px 0">CBC (AUTOMATED)</div>
      <table style="font-size:24px">
        ${r.rows.map((x) => `<tr><td style="padding:6px 0">${esc(x[0])}</td><td style="text-align:right"><b>${esc(x[1])}</b></td><td style="padding-left:10px">${flag(x[4])}</td><td style="padding-left:10px">${esc(x[2])}</td><td style="padding-left:10px;color:#444">(${esc(x[3])})</td></tr>`).join("")}
      </table>
      <hr style="border:0;border-top:2px dashed #333">
      <div style="font-size:19px">*** END OF REPORT ***</div>
    </div>`,

  hospital: (r) => `
    ${header(r, `<div style="font-size:22px;text-align:right;border:2px solid ${r.lab.color};padding:10px">IN-PATIENT<br>LAB SLIP</div>`)}
    ${patientBox(r)}
    <table style="font-size:25px;border:2px solid #333">
      <tr style="background:#fee2e2"><th style="border:1px solid #333;padding:10px;text-align:left">Investigation</th><th style="border:1px solid #333">Observed Value</th><th style="border:1px solid #333">Unit</th><th style="border:1px solid #333">Biological Ref. Interval</th></tr>
      ${r.rows.map((x) => `<tr><td style="border:1px solid #333;padding:12px">${esc(x[0])}</td><td style="border:1px solid #333;text-align:center"><b>${esc(x[1])}</b> ${flag(x[4])}</td><td style="border:1px solid #333;text-align:center">${esc(x[2])}</td><td style="border:1px solid #333;text-align:center">${esc(x[3])}</td></tr>`).join("")}
    </table>
    <p style="font-size:22px;margin-top:26px">Peripheral smear: Thrombocytopenia noted. Advised: repeat CBC after 24 hours.</p>`,

  rangefirst: (r) => `
    ${header(r)}
    ${patientBox(r)}
    <div style="font-size:30px;font-weight:800;margin:10px 0 16px;color:${r.lab.color}">CBC WITH PLATELET COUNT</div>
    <table style="font-size:26px">
      <tr style="border-bottom:3px solid ${r.lab.color}"><th style="text-align:left;padding:12px">Test</th><th style="text-align:left">Normal Range</th><th style="text-align:left">Unit</th><th style="text-align:left">Your Result</th></tr>
      ${r.rows.map((x) => `<tr style="border-bottom:1px solid #ddd"><td style="padding:14px 12px">${esc(x[0])}</td><td style="color:#555">${esc(x[3])}</td><td>${esc(x[2])}</td><td><b style="font-size:28px">${esc(x[1])}</b> ${flag(x[4])}</td></tr>`).join("")}
    </table>`,

  serology: (r) => `
    ${header(r)}
    ${patientBox(r)}
    <div style="text-align:center;font-size:32px;font-weight:800;text-decoration:underline;margin:10px 0 18px">IMMUNOLOGY / SEROLOGY REPORT</div>
    <table style="font-size:26px">
      <tr style="background:#f1f5f9"><th style="text-align:left;padding:12px">Test Name</th><th style="text-align:left">Result</th><th style="text-align:left">Reference</th></tr>
      ${r.rows.map((x) => `<tr style="border-bottom:1px solid #e2e8f0"><td style="padding:14px 12px">${esc(x[0])}</td><td><b>${esc(x[1])}</b></td><td>${esc(x[3])}</td></tr>`).join("")}
    </table>
    <p style="font-size:22px;margin-top:30px">Method: Rapid immunochromatographic test.</p>`,
};

const page = (r) => `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss}</style></head>
<body><div class="page"><div class="wm">SAMPLE</div>${layouts[r.layout](r)}<div class="foot">${SAMPLE_NOTE}</div></div></body></html>`;

/** Same report, shown as if photographed on a table: tilt, perspective, shadow, uneven light. */
const photo = (r) => `<!doctype html><html><head><meta charset="utf-8"><style>
  ${baseCss}
  html,body { width:1240px; height:1654px; overflow:hidden }
  body { background: radial-gradient(circle at 30% 20%, #8b6f4e, #5b4631 70%, #3f3022) }
  .wrap { position:absolute; left:90px; top:40px; transform: perspective(2400px) rotateX(6deg) rotateZ(-3deg) scale(.82); transform-origin: 50% 0;
          box-shadow: 0 30px 60px rgba(0,0,0,.55) }
  .light { position:absolute; inset:0; background: linear-gradient(115deg, rgba(255,255,255,.18), rgba(0,0,0,0) 40%, rgba(0,0,0,.18)); pointer-events:none }
  .page { filter: contrast(.94) brightness(.97) blur(.35px); background:#fbfaf6 }
</style></head><body><div class="wrap"><div class="page"><div class="wm">SAMPLE</div>${layouts[r.layout](r)}<div class="foot">${SAMPLE_NOTE}</div></div></div><div class="light"></div></body></html>`;

/* ------------------------------- render -------------------------------- */
function chrome(args) {
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-pdf-header-footer", ...args], { stdio: "ignore" });
}

for (const r of reports) {
  const clean = join(TMP, `${r.id}.html`);
  const ph = join(TMP, `${r.id}-photo.html`);
  writeFileSync(clean, page(r));
  writeFileSync(ph, photo(r));
  chrome([`--window-size=1240,1754`, `--screenshot=${join(OUT, `${r.id}.png`)}`, pathToFileURL(clean).href]);
  chrome([`--window-size=1240,1654`, `--screenshot=${join(OUT, `${r.id}-photo.png`)}`, pathToFileURL(ph).href]);
  chrome([`--print-to-pdf=${join(OUT, `${r.id}.pdf`)}`, pathToFileURL(clean).href]);
  console.log("✓", r.id);
}

writeFileSync(
  join(OUT, "index.json"),
  JSON.stringify(reports.map(({ id, title, date, expected }) => ({ id, title, date, expected })), null, 2),
);
rmSync(TMP, { recursive: true, force: true });
console.log(`\n${reports.length} reports written to ${OUT}`);
