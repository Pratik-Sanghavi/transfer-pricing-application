"use client";

export default function AuditTab({ audit }) {
  return (
    <>
      <h2>Audit trail: what the AI proposed vs. what the consultant decided</h2>
      {!audit.length && <p className="muted">No actions yet.</p>}
      {[...audit].reverse().map((a, i) => (
        <details key={i} className="trig">
          <summary>
            <span className="small muted">{a.time}</span>
            <span><b>{a.step}</b> · {a.entity} · {a.detail}</span>
          </summary>
          {a.ai && (
            <div className="grid g2" style={{ marginTop: 8 }}>
              <div><div className="small muted">AI proposed</div><pre className="json">{JSON.stringify(a.ai, null, 2)}</pre></div>
              {a.human && <div><div className="small muted">Consultant final</div><pre className="json">{JSON.stringify(a.human, null, 2)}</pre></div>}
            </div>
          )}
        </details>
      ))}
    </>
  );
}
