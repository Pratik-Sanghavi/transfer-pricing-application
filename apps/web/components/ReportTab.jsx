"use client";
import { useState } from "react";
import { marked } from "marked";
import { BENCHMARKS, CURRENT_YEAR, benchmark, runAll } from "@/lib/rules";
import { post } from "./App";
import { screenEntity } from "./BenchmarkTab";

export default function ReportTab({ data, ents, far, screening, setScreening, accepted, report, setReport, log, persist }) {
  const [eid, setEid] = useState("E05");
  const [busy, setBusy] = useState(false);
  const missing = [!far[eid] && "approve the FAR", !screening[eid] && "screen comparables"].filter(Boolean);

  async function generate() {
    setBusy(true);
    try {
      let rows = screening[eid], acc = accepted;
      if (!rows) {
        ({ rows } = await screenEntity({ data, ents, far, eid }));
        setScreening((s) => ({ ...s, [eid]: rows }));
        persist("screening", { eid, rows });
        acc = { ...accepted, [eid]: rows.filter((r) => r.accept).map((r) => r.comp_id) };
      }
      const ctx = {
        year: CURRENT_YEAR, entity: ents[eid], far: far[eid] || null,
        benchmark: benchmark(data, eid, acc[eid]),
        screening: rows.map((r) => ({ comp_id: r.comp_id, decision: r.accept ? "Accept" : "Reject", criterion: r.criterion, reason: r.reason })),
        triggers: runAll(data, CURRENT_YEAR, acc).filter((t) => t.entity_id === eid),
      };
      const { result, source } = await post("/api/report", { ctx });
      setReport((r) => ({ ...r, [eid]: { text: result, source } }));
      persist("report", { eid, text: result, source });
      log("Report draft", eid, `Generated local file section (${source})`);
    } catch (e) { alert(e.message); }
    setBusy(false);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([report[eid].text], { type: "text/markdown" }));
    Object.assign(document.createElement("a"), { href: url, download: `local_file_${eid}_FY${CURRENT_YEAR}.md` }).click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <h2>Local file: benchmarking &amp; compliance section</h2>
      <div className="row" style={{ alignItems: "flex-end", marginBottom: 12 }}>
        <label className="field" style={{ minWidth: 360 }}>
          Entity
          <select value={eid} onChange={(e) => setEid(e.target.value)}>
            {Object.keys(BENCHMARKS).map((id) => <option key={id} value={id}>{id} · {ents[id].entity_name}</option>)}
          </select>
        </label>
        <button className="btn primary" onClick={generate} disabled={busy}>{busy ? "Drafting…" : "Generate draft"}</button>
        {report[eid] && <button className="btn" onClick={download}>Download .md</button>}
        {report[eid] && <span className={`pill ${report[eid].source}`}>{report[eid].source}</span>}
      </div>
      {missing.length > 0 && <div className="small muted">Tip: {missing.join(" and ")} first for a stronger draft (defaults will be used).</div>}
      {report[eid] && (
        <div className="panel report" style={{ marginTop: 12 }} dangerouslySetInnerHTML={{ __html: marked.parse(report[eid].text) }} />
      )}
    </>
  );
}
