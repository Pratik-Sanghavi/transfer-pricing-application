"use client";
import { useMemo, useState } from "react";
import { CURRENT_YEAR, applyMarginShock, entityStatus, runAll } from "@/lib/rules";
import FlowGraph from "./FlowGraph";

export function Kpi({ label, value, delta, tone }) {
  return (
    <div className="panel kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta ? <div className={`delta ${tone || ""}`}>{delta}</div> : null}
    </div>
  );
}

export default function Dashboard({ data, ents, accepted, persistence }) {
  const [wiEnt, setWiEnt] = useState("");
  const [wiDelta, setWiDelta] = useState(0);
  const [filter, setFilter] = useState("");
  const acc = Object.keys(accepted).length ? accepted : null;

  const view = useMemo(() => applyMarginShock(data, wiEnt, CURRENT_YEAR, wiDelta), [data, wiEnt, wiDelta]);
  const triggers = useMemo(() => runAll(view, CURRENT_YEAR, acc), [view, acc]);
  const baseN = useMemo(() => runAll(data, CURRENT_YEAR, acc).length, [data, acc]);
  const status = useMemo(() => entityStatus(view, triggers), [view, triggers]);

  const count = (s) => triggers.filter((t) => t.severity === s).length;
  const adj = triggers.reduce((s, t) => s + (t.metrics.adjustment_usd || 0), 0);
  const shown = triggers.filter((t) => !filter || t.entity_id === filter);

  return (
    <>
      <h2>Group compliance dashboard</h2>

      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="field" style={{ minWidth: 220 }}>
            What-if: shock an entity&apos;s FY{CURRENT_YEAR} margin
            <select value={wiEnt} onChange={(e) => { setWiEnt(e.target.value); setWiDelta(0); }}>
              <option value="">None</option>
              {["E02", "E05", "E04", "E03"].map((id) => <option key={id} value={id}>{id} · {ents[id].country}</option>)}
            </select>
          </label>
          <label className="field" style={{ flex: 1, minWidth: 240 }}>
            Change: {wiDelta > 0 ? "+" : ""}{wiDelta.toFixed(1)} pp of PLI base
            <input type="range" min={-5} max={8} step={0.5} value={wiDelta} disabled={!wiEnt}
                   onChange={(e) => setWiDelta(Number(e.target.value))} />
          </label>
        </div>
        {wiEnt && wiDelta !== 0 && (
          <div className="note warn">What-if active: {ents[wiEnt].country} margin {wiDelta > 0 ? "+" : ""}{wiDelta} pp → <b>{triggers.length}</b> triggers (baseline {baseN}).</div>
        )}
      </div>

      <div className="grid g5">
        <Kpi label="Open triggers" value={triggers.length} delta={wiEnt && wiDelta ? `baseline ${baseN}` : ""} />
        <Kpi label="High" value={count("High")} />
        <Kpi label="Medium" value={count("Medium")} />
        <Kpi label="Info" value={count("Info")} />
        <Kpi label="Est. adjustments" value={`USD ${(adj / 1e6).toFixed(1)}M`} />
      </div>

      <div className="grid g5" style={{ marginTop: 12 }}>
        {data.entities.map((e) => {
          const n = triggers.filter((t) => t.entity_id === e.entity_id).length;
          return (
            <button key={e.entity_id} className={`panel ent ${status[e.entity_id]}`} style={{ textAlign: "left", cursor: "pointer" }}
                    onClick={() => setFilter(filter === e.entity_id ? "" : e.entity_id)}>
              <div className="country"><span className={`dot ${status[e.entity_id]}`} />{e.country}</div>
              <div className="name">{e.entity_name}</div>
              <div className="name">{e.role}</div>
              <div style={{ marginTop: 6 }}>{n} trigger{n === 1 ? "" : "s"}{filter === e.entity_id ? " · filtered" : ""}</div>
            </button>
          );
        })}
      </div>

      <div className="split">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Intercompany flows (FY{CURRENT_YEAR})</h3>
          <FlowGraph data={view} triggers={triggers} status={status} ents={ents} />
          <div className="small muted">Red edges carry a flagged transaction or an out-of-range result.</div>
        </div>
        <div>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Triggers {filter && `· ${filter === "GROUP" ? "Group" : ents[filter].country}`}</h3>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All entities</option>
              {[...data.entities.map((e) => e.entity_id), "GROUP"].map((id) =>
                <option key={id} value={id}>{id === "GROUP" ? "Group" : `${id} · ${ents[id].country}`}</option>)}
            </select>
          </div>
          <div className="triglist">
          {shown.map((t, i) => (
            <details key={`${t.rule_id}-${t.entity_id}-${t.fiscal_year}-${i}`} className="trig">
              <summary>
                <span className={`pill ${t.severity}`}>{t.severity}</span>
                <span><b>{t.entity_id === "GROUP" ? "Group" : ents[t.entity_id].country}</b> · {t.trigger}{t.fiscal_year !== CURRENT_YEAR ? ` (FY${t.fiscal_year})` : ""}</span>
              </summary>
              <p>{t.detail}</p>
              <p><b>Action:</b> {t.action}</p>
              <p className="ref">Why: {t.rule_id} · {t.jurisdiction} · {t.reference}</p>
              {persistence?.mode === "neo4j" && (
                <p className="small muted" style={{ fontFamily: "ui-monospace, monospace" }}>
                  Neo4j: {t.metrics.txn_id
                    ? `(:Transaction {txn_id:'${t.metrics.txn_id}'})-[:TRIGGERS]->(:Rule {rule_id:'${t.rule_id}'})`
                    : t.entity_id === "GROUP"
                      ? `(:Case)-[:FLAGGED_BY]->(:Rule {rule_id:'${t.rule_id}'})`
                      : `(:LegalEntity {entity_id:'${t.entity_id}'})-[:FLAGGED_BY]->(:Rule {rule_id:'${t.rule_id}'})`}
                </p>
              )}
            </details>
          ))}
          </div>
        </div>
      </div>
    </>
  );
}
