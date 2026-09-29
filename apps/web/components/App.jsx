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

export default function App({ data, llm, initialState, persistence: initialPersistence }) {
  const init = initialState || {};
  const [tab, setTab] = useState("dash");
  const [far, setFar] = useState(init.far || {});             // eid -> approved FAR
  const [farAi, setFarAi] = useState(init.farAi || {});       // eid -> AI proposal
  const [screening, setScreening] = useState(init.screening || {}); // eid -> rows
  const [report, setReport] = useState(init.report || {});    // eid -> {text, source}
  const [audit, setAudit] = useState(init.audit || []);
  const [persistence, setPersistence] = useState(initialPersistence || { mode: "csv" });
  const [saveError, setSaveError] = useState(null);

  // Every consultant action is written to Neo4j (no-op in CSV mode). Fire-and-forget keeps the UI instant.
  const persist = useCallback((op, payload = {}) => {
    if (persistence.mode !== "neo4j") return Promise.resolve();
    return post("/api/state", { op, ...payload })
      .then((r) => {
        if (r.persisted) { setSaveError(null); setPersistence((p) => ({ ...p, nodes: r.nodes, rels: r.rels })); }
        else setSaveError(r.error || "not saved");
      })
      .catch((e) => setSaveError(e.message));
  }, [persistence.mode]);

  async function resetDemo() {
    if (!confirm("Clear FAR approvals, screening, reports and the audit trail for this case?")) return;
    await persist("reset");
    window.location.reload();
  }

  const ents = useMemo(() => Object.fromEntries(data.entities.map((e) => [e.entity_id, e])), [data]);
  const accepted = useMemo(
    () => Object.fromEntries(Object.entries(screening).map(([k, rows]) => [k, rows.filter((r) => r.accept).map((r) => r.comp_id)])),
    [screening]);
  const log = useCallback((step, entity, detail, ai = null, human = null) => {
    const event = { time: new Date().toLocaleTimeString(), step, entity, detail, ai, human };
    setAudit((a) => [...a, event]);
    persist("audit", { event });
  }, [persist]);

  const ctx = { data, llm, ents, far, setFar, farAi, setFarAi, screening, setScreening, report, setReport, audit, log, accepted,
                persist, persistence };

  return (
    <div className="shell">
      <aside className="side">
        <h1>TP Copilot</h1>
        <div className="sub">Transfer pricing triggers → FAR → TNMM benchmark → local file</div>
        <dl>
          <dt>Client</dt><dd>Novatek Group</dd>
          <dt>Persistence</dt>
          <dd>
            {persistence.mode === "neo4j"
              ? <><span className="pill live">Neo4j</span><div className="small muted" style={{ marginTop: 6 }}>{persistence.nodes} nodes · {persistence.rels} relationships</div></>
              : <><span className="pill mock">CSV fallback</span><div className="small muted" style={{ marginTop: 6 }}>{persistence.error ? `Neo4j unreachable: ${persistence.error.split(". ")[0]}` : "Set NEO4J_URI to persist to the graph."}</div></>}
            {saveError && <div className="small" style={{ color: "var(--red)", marginTop: 4 }}>Last save failed: {saveError}</div>}
          </dd>
          <dt>Fiscal year</dt><dd>FY{CURRENT_YEAR}</dd>
          <dt>LLM</dt>
          <dd>
            {llm.live
              ? <><span className="pill live">Live · OpenRouter</span><div className="small muted" style={{ marginTop: 6 }}>Fast: {llm.fast}<br />Strong: {llm.strong}</div></>
              : <><span className="pill mock">Demo mode</span><div className="small muted" style={{ marginTop: 6 }}>No OPENROUTER_API_KEY — mock outputs.</div></>}
          </dd>
        </dl>
        <button className="btn" style={{ width: "100%", marginBottom: 12 }} onClick={resetDemo}>Reset demo case</button>
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
