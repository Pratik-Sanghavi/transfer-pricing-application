"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Dashboard from "./Dashboard";
import FarTab from "./FarTab";
import BenchmarkTab from "./BenchmarkTab";
import ReportTab from "./ReportTab";
import AuditTab from "./AuditTab";
import { CURRENT_YEAR } from "@/lib/rules";

export async function post(url, body) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`);
  return response.json();
}

const TABS = [["dash", "Dashboard"], ["far", "FAR analysis"], ["bench", "Benchmark"], ["report", "Report"], ["audit", "Audit trail"]];

export default function App({ data, llm }) {
  const [tab, setTab] = useState("dash");
  const [far, setFar] = useState({});
  const [farAi, setFarAi] = useState({});
  const [screening, setScreening] = useState({});
  const [report, setReport] = useState({});
  const [audit, setAudit] = useState([]);

  useEffect(() => {
    fetch("/api/audit").then((response) => response.ok ? response.json() : []).then(setAudit).catch(() => {});
  }, []);

  const ents = useMemo(() => Object.fromEntries(data.entities.map((entity) => [entity.entity_id, entity])), [data]);
  const accepted = useMemo(() => Object.fromEntries(Object.entries(screening).map(([key, rows]) => [key, rows.filter((row) => row.accept).map((row) => row.comp_id)])), [screening]);
  const log = useCallback((step, entity, detail, ai = null, human = null) => {
    const optimistic = { id: crypto.randomUUID(), time: new Date().toISOString(), step, entity, detail, ai, human };
    setAudit((events) => [...events, optimistic]);
    post("/api/audit", { step, entity, detail, ai, human }).then((saved) => {
      setAudit((events) => events.map((event) => event.id === optimistic.id ? saved : event));
    }).catch(() => {});
  }, []);

  const ctx = { data, llm, ents, far, setFar, farAi, setFarAi, screening, setScreening, report, setReport, audit, log, accepted };
  return <div className="shell"><aside className="side"><h1>TP Copilot</h1><div className="sub">Transfer pricing triggers → FAR → TNMM benchmark → local file</div><dl><dt>Client</dt><dd>Novatek Group</dd><dt>Source</dt><dd>Neo4j graph</dd><dt>Fiscal year</dt><dd>FY{CURRENT_YEAR}</dd><dt>LLM</dt><dd>{llm.live ? <><span className="pill live">Live · OpenRouter</span><div className="small muted" style={{ marginTop: 6 }}>Fast: {llm.fast}<br />Strong: {llm.strong}</div></> : <><span className="pill mock">Demo mode</span><div className="small muted" style={{ marginTop: 6 }}>No OPENROUTER_API_KEY — mock outputs.</div></>}</dd></dl><p className="small muted">Thresholds and statutory references are illustrative for this prototype.</p></aside><main className="main"><nav className="tabs">{TABS.map(([key, label]) => <button key={key} className={`tab ${tab === key ? "on" : ""}`} onClick={() => setTab(key)}>{label}{key === "audit" && audit.length ? ` (${audit.length})` : ""}</button>)}</nav>{tab === "dash" && <Dashboard {...ctx} />}{tab === "far" && <FarTab {...ctx} />}{tab === "bench" && <BenchmarkTab {...ctx} />}{tab === "report" && <ReportTab {...ctx} />}{tab === "audit" && <AuditTab {...ctx} />}</main></div>;
}