"use client";
import { CURRENT_YEAR } from "@/lib/rules";

// Fixed layout: parent in the centre, subsidiaries around it (no edge passes through a node).
const POS = { E01: [400, 240], E02: [680, 80], E04: [680, 400], E05: [120, 80], E03: [120, 400] };
const W = 176, H = 60;
const SHORT = { "software development": "SW dev services", "management fee": "Mgmt fee", "contract manufacturing": "Contract mfg",
  "low value-adding": "LVA services", "intercompany loan interest": "Loan interest", "finished products": "Goods", "royalty": "Royalty" };
const ROLE = { E01: "Parent · IP owner", E02: "Captive software dev", E03: "Procurement services", E04: "Contract manufacturer", E05: "Limited-risk distributor" };
const FILL = { red: "var(--red-soft)", amber: "var(--amber-soft)", green: "var(--green-soft)" };
const STROKE = { red: "var(--red)", amber: "var(--amber)", green: "var(--green)" };

// Point where a line from the box centre towards (tx,ty) leaves the box.
function clip([cx, cy], [tx, ty], pad = 4) {
  const dx = tx - cx, dy = ty - cy;
  const t = Math.min((W / 2 + pad) / Math.abs(dx || 1e-9), (H / 2 + pad) / Math.abs(dy || 1e-9));
  return [cx + dx * t, cy + dy * t];
}

export default function FlowGraph({ data, triggers, status, ents }) {
  const tx = data.ic_transactions.filter((t) => t.fiscal_year === CURRENT_YEAR);

  const flagged = new Set();
  for (const t of triggers) {
    if (t.metrics.txn_id) {
      const r = tx.find((x) => x.txn_id === t.metrics.txn_id);
      if (r) flagged.add(`${r.provider_entity}>${r.recipient_entity}`);
    } else if (["R01", "R02", "R09", "R10"].includes(t.rule_id) && ents[t.entity_id]) {
      flagged.add(`${t.entity_id}>E01`); flagged.add(`E01>${t.entity_id}`);
    }
  }

  const agg = {};
  for (const r of tx) {
    const k = `${r.provider_entity}>${r.recipient_entity}`;
    agg[k] ??= { a: r.provider_entity, b: r.recipient_entity, usd: 0, types: new Set() };
    agg[k].usd += r.amount_usd;
    const ty = r.transaction_type.split(" - ").pop();
    agg[k].types.add(SHORT[ty] || ty);
  }

  const edges = Object.entries(agg).map(([k, e]) => {
    const A = POS[e.a], B = POS[e.b];
    const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy);
    const off = 40; // perpendicular offset -> opposite directions curve to opposite sides
    const C = [(A[0] + B[0]) / 2 - (dy / len) * off, (A[1] + B[1]) / 2 + (dx / len) * off];
    const s = clip(A, C), t = clip(B, C, 8);
    const mid = [0.25 * s[0] + 0.5 * C[0] + 0.25 * t[0], 0.25 * s[1] + 0.5 * C[1] + 0.25 * t[1]];
    return { k, ...e, s, t, C, mid, hot: flagged.has(k) };
  });

  return (
    <svg viewBox="0 0 800 480" width="100%" role="img" aria-label="Intercompany transaction flows">
      <defs>
        {["hot", "cold"].map((id) => (
          <marker key={id} id={`arrow-${id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={id === "hot" ? "var(--red)" : "var(--muted)"} />
          </marker>
        ))}
      </defs>
      {edges.map((e) => (
        <path key={e.k} d={`M${e.s[0]},${e.s[1]} Q${e.C[0]},${e.C[1]} ${e.t[0]},${e.t[1]}`} fill="none"
              stroke={e.hot ? "var(--red)" : "var(--muted)"} strokeWidth={e.hot ? 2.5 : 1.2} strokeOpacity={e.hot ? 1 : 0.6}
              markerEnd={`url(#arrow-${e.hot ? "hot" : "cold"})`}>
          <title>{`${e.a} → ${e.b}: ${[...e.types].join(", ")} · USD ${(e.usd / 1e6).toFixed(1)}M`}</title>
        </path>
      ))}
      {edges.map((e) => (
        <g key={`l-${e.k}`} transform={`translate(${e.mid[0]},${e.mid[1]})`}>
          {(() => {
            const l1 = [...e.types].join(", "), w = Math.max(l1.length, 11) * 6.6 + 10;
            return (<>
              <rect x={-w / 2} y={-15} width={w} height={32} rx="5" fill="var(--panel)" stroke={e.hot ? "var(--red)" : "var(--line)"} strokeWidth="0.8" />
              <text textAnchor="middle" fontSize="12" style={{ fill: e.hot ? "var(--red)" : "var(--muted)" }}>
                <tspan x="0" dy="-2">{l1}</tspan>
                <tspan x="0" dy="14" fontWeight="600">USD {(e.usd / 1e6).toFixed(1)}M</tspan>
              </text>
            </>);
          })()}
        </g>
      ))}
      {Object.entries(POS).map(([id, [x, y]]) => {
        const e = ents[id], st = status[id];
        return (
          <g key={id} transform={`translate(${x - W / 2},${y - H / 2})`}>
            <rect width={W} height={H} rx="10" fill={FILL[st]} stroke={STROKE[st]} strokeWidth="1.5" />
            <text x={W / 2} y="25" textAnchor="middle" fontSize="15" fontWeight="600">{e.country}</text>
            <text x={W / 2} y="44" textAnchor="middle" fontSize="12" style={{ fill: "var(--muted)" }}>{ROLE[id]}</text>
          </g>
        );
      })}
    </svg>
  );
}
