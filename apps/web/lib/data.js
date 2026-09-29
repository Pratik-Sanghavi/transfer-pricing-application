// Server-only: the "ERP connector" stub. Swap for a real SAP/Oracle/NetSuite extract later.
import fs from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "data");
const NUM = /^-?\d+(\.\d+)?$/;

export function parseCsv(text) {
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => {
    const v = r[i] ?? "";
    return [h, NUM.test(v) ? Number(v) : v];
  })));
}

const read = (n) => parseCsv(fs.readFileSync(path.join(DIR, `${n}.csv`), "utf8"));

export function readInterview() {
  return fs.readFileSync(path.join(DIR, "far_interview_germany.md"), "utf8");
}

export function loadClientData() {
  const tp_rules = read("tp_rules");
  return {
    entities: read("entities"),
    financials: read("financials"),
    ic_transactions: read("ic_transactions"),
    tp_rules,
    rulesMeta: Object.fromEntries(tp_rules.map((r) => [r.rule_id, r])),
    comparables_services: read("comparables_services"),
    comparables_distributors: read("comparables_distributors"),
    sampleTranscript: readInterview().split("## Answer key")[0].trim(),
  };
}
