"use client";
import { useCallback, useMemo, useState } from "react";
import Dashboard from "./Dashboard";
import FarTab from "./FarTab";
import BenchmarkTab from "./BenchmarkTab";
import ReportTab from "./ReportTab";
import AuditTab from "./AuditTab";
import { CURRENT_YEAR } from "@/lib/rules";

export async function post(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${url} failed: ${r.status}`);
  return r.json();
}

const TABS = [
  ["dash", "Dashboard"], ["far", "FAR analysis"], ["bench", "Benchmark"], ["report", "Report"], ["audit", "Audit trail"],
];

export default function App({ data, llm }) {
  const [tab, setTab] = useState("dash");
  const [far, setFar] = useState({});           // eid -> approved FAR
  const [farAi, setFarAi] = useState({});       // eid -> AI proposal
  const [screening, setScreening] = useState({}); // eid -> rows
  const [report, setReport] = useState({});     // eid -> {text, source}
  const [audit, setAudit] = useState([]);

  const ents = useMemo(() => Object.fromEntries(data.entities.map((e) => [e.entity_id, e])), [data]);
  const accepted = useMemo(
    () => Object.fromEntries(Object.entries(screening).map(([k, rows]) => [k, rows.filter((r) => r.accept).map((r) => r.comp_id)])),
    [screening]);
  const log = useCallback((step, entity, detail, ai = null, human = null) =>
    setAudit((a) => [...a, { time: new Date().toLocaleTimeString(), step, entity, detail, ai, human }]), []);

  const ctx = { data, llm, ents, far, setFar, farAi, setFarAi, screening, setScreening, report, setReport, audit, log, accepted };

  return (
    <div className="shell">
      <aside className="side">
        <h1>TP Copilot</h1>
        <div className="sub">Transfer pricing triggers → FAR → TNMM benchmark → local file</div>
        <dl>
          <dt>Client</dt><dd>Novatek Group</dd>
          <dt>Source</dt><dd>ERP connector (mock extract)</dd>
          <dt>Fiscal year</dt><dd>FY{CURRENT_YEAR}</dd>
          <dt>LLM</dt>
          <dd>
            {llm.live
              ? <><span className="pill live">Live · OpenRouter</span><div className="small muted" style={{ marginTop: 6 }}>Fast: {llm.fast}<br />Strong: {llm.strong}</div></>
              : <><span className="pill mock">Demo mode</span><div className="small muted" style={{ marginTop: 6 }}>No OPENROUTER_API_KEY — mock outputs.</div></>}
          </dd>
        </dl>
        <p className="small muted">Thresholds and statutory references are illustrative for this prototype.</p>
      </aside>
      <main className="main">
        <nav className="tabs">
          {TABS.map(([k, label]) => (
            <button key={k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>
              {label}{k === "audit" && audit.length ? ` (${audit.length})` : ""}
            </button>
          ))}
        </nav>
        {tab === "dash" && <Dashboard {...ctx} />}
        {tab === "far" && <FarTab {...ctx} />}
        {tab === "bench" && <BenchmarkTab {...ctx} />}
        {tab === "report" && <ReportTab {...ctx} />}
        {tab === "audit" && <AuditTab {...ctx} />}
      </main>
    </div>
  );
}
