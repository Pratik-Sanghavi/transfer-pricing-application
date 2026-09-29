"use client";
import { useState } from "react";
import { post } from "./App";

export default function FarTab({ data, ents, far, setFar, farAi, setFarAi, log }) {
  const [eid, setEid] = useState("E05");
  const [transcripts, setTranscripts] = useState({});
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const ent = ents[eid];
  const transcript = transcripts[eid] || "";

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (f) setTranscripts({ ...transcripts, [eid]: await f.text() });
  }

  async function extract() {
    setBusy(true); setMsg(null);
    try {
      const { result, source } = await post("/api/far", { transcript, entity: ent });
      setFarAi({ ...farAi, [eid]: result });
      setDrafts({ ...drafts, [eid]: JSON.stringify(result, null, 2) });
      log("FAR extraction", eid, `AI proposed FAR (${source})`, result);
    } catch (e) { setMsg({ tone: "err", text: e.message }); }
    setBusy(false);
  }

  function reject() {
    const reason = rejectionReason.trim() || "Consultant rejected the FAR proposal; revision required.";
    log("FAR rejected", eid, reason, farAi[eid], { rejection_reason: reason });
    setMsg({ tone: "err", text: "FAR rejected and recorded in the Neo4j audit trail." });
  }

  function approve() {
    try {
      const final = JSON.parse(drafts[eid]);
      const changed = JSON.stringify(final) !== JSON.stringify(farAi[eid]);
      setFar({ ...far, [eid]: final });
      log("FAR approval", eid, `Consultant approved${changed ? " with edits" : " as proposed"}`, changed ? farAi[eid] : null, changed ? final : null);
      setMsg({ tone: "ok", text: "FAR approved and locked for benchmarking." });
    } catch (e) { setMsg({ tone: "err", text: `JSON error: ${e.message}` }); }
  }

  const flags = farAi[eid]?.flags_for_human_review || [];

  return (
    <>
      <h2>Functional analysis (FAR) · human in the loop</h2>
      <label className="field" style={{ maxWidth: 420, marginBottom: 14 }}>
        Entity
        <select value={eid} onChange={(e) => { setEid(e.target.value); setMsg(null); }}>
          {data.entities.map((e) => <option key={e.entity_id} value={e.entity_id}>{e.entity_id} · {e.entity_name}</option>)}
        </select>
      </label>

      <div className="grid g2">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>1 · Pre-filled from ERP entity master</h3>
          {[["Functions", ent.key_functions], ["Assets", ent.key_assets], ["Risks", ent.key_risks]].map(([l, v]) => (
            <label key={l} className="field" style={{ marginBottom: 8 }}>{l}<textarea readOnly rows={2} value={v} /></label>
          ))}
          <div className="small muted">Characterisation on file: <b>{ent.role}</b></div>
        </div>
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>2 · Client interview (PLAUD transcript)</h3>
          <div className="row" style={{ marginBottom: 8 }}>
            <input type="file" accept=".txt,.md" onChange={onFile} />
            {data.sampleTranscript && <button className="btn" onClick={() => setTranscripts({ ...transcripts, [eid]: data.sampleTranscript })}>Load sample (Germany CFO)</button>}
          </div>
          <textarea rows={11} value={transcript} placeholder="Paste or upload the interview transcript…"
                    onChange={(e) => setTranscripts({ ...transcripts, [eid]: e.target.value })} />
        </div>
      </div>

      <div className="row" style={{ margin: "14px 0" }}>
        <button className="btn primary" onClick={extract} disabled={busy}>{busy ? "Reading the interview…" : "Extract FAR with AI"}</button>
        {far[eid] && <span className="pill live">Approved FAR on file</span>}
      </div>

      {farAi[eid] && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>3 · Review &amp; edit the AI proposal</h3>
          {flags.map((f, i) => <div key={i} className="note warn">⚑ {f}</div>)}
          <textarea className="mono" rows={18} value={drafts[eid] || ""} onChange={(e) => setDrafts({ ...drafts, [eid]: e.target.value })} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={approve}>Approve FAR</button>
            <button className="btn" onClick={reject}>Reject FAR</button>
            <input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Optional rejection reason" style={{ flex: 1, minWidth: 220 }} />
          </div>
        </div>
      )}
      {msg && <div className={`note ${msg.tone}`}>{msg.text}</div>}
    </>
  );
}
