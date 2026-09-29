"use client";
import { useState } from "react";
import { BENCHMARKS, PLI_LONG, benchmark, compSummary } from "@/lib/rules";
import { post } from "./App";
import { Kpi } from "./Dashboard";
import RangeChart from "./RangeChart";

const pct = (x) => `${(x * 100).toFixed(1)}%`;

export async function screenEntity({ data, ents, far, eid }) {
  const { compKey, pli } = BENCHMARKS[eid];
  const summ = compSummary(data[compKey], pli);
  const comps = summ.map(({ comp_id, company_name, country, business_description, largest_shareholder_pct, loss_years }) =>
    ({ comp_id, company_name, country, business_description, largest_shareholder_pct, loss_years }));
  const { result, source } = await post("/api/screen", { comps, tested: ents[eid], far: far[eid] });
  const by = Object.fromEntries(result.map((r) => [r.comp_id, r]));
  const rows = summ.map((c) => ({
    comp_id: c.comp_id, accept: by[c.comp_id]?.decision === "Accept", ai_decision: by[c.comp_id]?.decision || "n/a",
    criterion: by[c.comp_id]?.criterion || "", reason: by[c.comp_id]?.reason || "",
  }));
  return { rows, source };
}

export default function BenchmarkTab({ data, ents, far, screening, setScreening, accepted, log, persist }) {
  const [eid, setEid] = useState("E02");
  const [busy, setBusy] = useState(false);
  const { compKey, pli } = BENCHMARKS[eid];
  const summ = compSummary(data[compKey], pli);
  const rows = screening[eid];
  const acc = accepted[eid];

  async function screen() {
    setBusy(true);
    try {
      const { rows, source } = await screenEntity({ data, ents, far, eid });
      setScreening((s) => ({ ...s, [eid]: rows }));
      persist("screening", { eid, rows });
      log("Comp screening", eid, `AI screened ${rows.length} comps, rejected ${rows.filter((r) => !r.accept).length} (${source})`);
    } catch (e) { alert(e.message); }
    setBusy(false);
  }

  function toggle(cid) {
    const next = rows.map((r) => (r.comp_id === cid ? { ...r, accept: !r.accept } : r));
    const r = next.find((x) => x.comp_id === cid);
    setScreening((s) => ({ ...s, [eid]: next }));
    persist("screening", { eid, rows: next });
    log("Screening override", eid, `${cid}: AI said ${r.ai_decision}, consultant set ${r.accept ? "Accept" : "Reject"}`);
  }

  const enough = !rows || (acc?.length || 0) >= 4;
  const b = enough ? benchmark(data, eid, acc) : null;
  const byId = rows ? Object.fromEntries(rows.map((r) => [r.comp_id, r])) : {};
  const chartRows = summ.map((c) => ({ ...c, accepted: !rows || byId[c.comp_id]?.accept }));

  return (
    <>
      <h2>TNMM benchmark</h2>
      <div className="row" style={{ alignItems: "flex-end", marginBottom: 12 }}>
        <label className="field" style={{ minWidth: 360 }}>
          Tested party
          <select value={eid} onChange={(e) => setEid(e.target.value)}>
            {Object.keys(BENCHMARKS).map((id) => <option key={id} value={id}>{id} · {ents[id].entity_name}</option>)}
          </select>
        </label>
        <button className="btn primary" onClick={screen} disabled={busy}>{busy ? "Screening against FAR + OECD Ch. III…" : "Screen comparables with AI"}</button>
        {far[eid] ? <span className="pill live">Using approved FAR</span> : <span className="small muted">No approved FAR yet; entity master used</span>}
      </div>
      <div className="note info">
        <b>Method:</b> TNMM (US: CPM, Treas. Reg. §1.482-5) · <b>Tested party:</b> {ents[eid].entity_name} (least complex, no unique intangibles) · <b>PLI:</b> {PLI_LONG[pli]}
      </div>

      {b ? (
        <div className="grid g5" style={{ margin: "12px 0" }}>
          <Kpi label="Lower quartile" value={pct(b.lq)} />
          <Kpi label="Median" value={pct(b.median)} />
          <Kpi label="Upper quartile" value={pct(b.uq)} />
          <Kpi label="Tested party (3-yr)" value={pct(b.tested_pli)} delta={`FY25 ${pct(b.current_pli)}`} />
          <Kpi label="Adjustment to median" value={b.outside ? `USD ${(b.adjustment_usd / 1e6).toFixed(2)}M` : "None"}
               delta={b.outside ? "Outside range" : "Within range"} tone={b.outside ? "bad" : "good"} />
        </div>
      ) : <div className="note err">Accept at least 4 comparables to compute a range.</div>}

      {b && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <RangeChart rows={chartRows} b={b} />
          <div className="small muted">Green band = interquartile range · dashed = median · red = tested party · grey bars = rejected</div>
        </div>
      )}

      <div className="panel scroll">
        {!rows && <div className="small muted" style={{ marginBottom: 8 }}>Unscreened candidate set. Run AI screening to build the accepted set.</div>}
        <table className="t">
          <thead><tr>
            {rows && <th>Accept</th>}<th>ID</th><th>Company</th><th>Country</th><th className="num">{pli} (3-yr)</th>
            <th className="num">Top holder</th>{rows && <><th>AI</th><th>Reason</th></>}{!rows && <th>Business description</th>}
          </tr></thead>
          <tbody>
            {summ.map((c) => {
              const r = byId[c.comp_id];
              const overridden = r && (r.accept ? "Accept" : "Reject") !== r.ai_decision;
              return (
                <tr key={c.comp_id} className={r && !r.accept ? "off" : ""}>
                  {rows && <td><input type="checkbox" checked={r.accept} onChange={() => toggle(c.comp_id)} title="Override the AI" /></td>}
                  <td>{c.comp_id}</td><td>{c.company_name}</td><td>{c.country}</td>
                  <td className="num">{pct(c.weighted_pli)}</td><td className="num">{c.largest_shareholder_pct}%</td>
                  {rows && <>
                    <td><span className={`pill ${r.ai_decision}`}>{r.ai_decision}</span>{overridden && <div className="small" style={{ color: "var(--amber)" }}>overridden</div>}</td>
                    <td><b>{r.criterion}</b> · {r.reason}</td>
                  </>}
                  {!rows && <td className="small">{c.business_description}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
