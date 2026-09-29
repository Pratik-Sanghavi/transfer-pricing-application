// CSV extract loader: the seed source for Neo4j and the offline fallback for the app.
import fs from "fs";
import path from "path";

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

const TABLES = ["entities", "financials", "ic_transactions", "tp_rules", "comparables_services", "comparables_distributors"];

// Returns the same shape the app and rule engine use everywhere.
export function loadCsvDir(dir) {
  const d = Object.fromEntries(TABLES.map((n) => [n, parseCsv(fs.readFileSync(path.join(dir, `${n}.csv`), "utf8"))]));
  d.rulesMeta = Object.fromEntries(d.tp_rules.map((r) => [r.rule_id, r]));
  const interview = path.join(dir, "far_interview_germany.md");
  d.sampleTranscript = fs.existsSync(interview) ? fs.readFileSync(interview, "utf8").split("## Answer key")[0].trim() : "";
  return d;
}
