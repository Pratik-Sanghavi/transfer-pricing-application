"use client";

export default function RangeChart({ rows, b }) {
  const W = 760, H = 280, L = 48, R = 130, T = 14, B = 34;
  const data = [...rows].sort((a, c) => a.weighted_pli - c.weighted_pli);
  const vals = [...data.map((d) => d.weighted_pli), b.tested_pli, 0];
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.1;
  const y0 = lo < 0 ? lo - pad : 0, y1 = hi + pad;
  const y = (v) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
  const bw = (W - L - R) / data.length;
  const raw = (y1 - y0) / 4, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw);
  const ticks = [];
  for (let t = Math.ceil(y0 / step) * step; t <= y1 + 1e-12; t += step) ticks.push(t);
  const pct = (v, dp = 1) => `${(v * 100).toFixed(dp)}%`;
  // Right-hand labels, nudged apart so they never overlap.
  const labels = [
    { t: `UQ ${pct(b.uq)}`, v: b.uq, c: "var(--muted)" },
    { t: `Median ${pct(b.median)}`, v: b.median, c: "var(--green)" },
    { t: `LQ ${pct(b.lq)}`, v: b.lq, c: "var(--muted)" },
    { t: `Tested ${pct(b.tested_pli)}`, v: b.tested_pli, c: "var(--red)", bold: true },
  ].map((l) => ({ ...l, ly: y(l.v) })).sort((a, c) => a.ly - c.ly);
  for (let i = 1; i < labels.length; i++) labels[i].ly = Math.max(labels[i].ly, labels[i - 1].ly + 13);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Comparable PLIs vs arm's length range">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={L - 6} y={y(t) + 4} fontSize="10" textAnchor="end" style={{ fill: "var(--muted)" }}>{pct(t, step < 0.01 ? 1 : 0)}</text>
        </g>
      ))}
      <rect x={L} width={W - L - R} y={y(b.uq)} height={y(b.lq) - y(b.uq)} fill="var(--green)" opacity="0.14" />
      {data.map((d, i) => {
        const top = y(Math.max(d.weighted_pli, 0)), bot = y(Math.min(d.weighted_pli, 0));
        return (
          <g key={d.comp_id}>
            <rect x={L + i * bw + bw * 0.18} width={bw * 0.64} y={top} height={Math.max(bot - top, 1)} rx="3"
                  fill={d.accepted ? "var(--bar)" : "var(--bar-off)"}>
              <title>{`${d.company_name}: ${pct(d.weighted_pli)}${d.accepted ? "" : " (rejected)"}`}</title>
            </rect>
            <text x={L + i * bw + bw / 2} y={H - B + 16} fontSize="10" textAnchor="middle" style={{ fill: "var(--muted)" }}>{d.comp_id}</text>
          </g>
        );
      })}
      <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--muted)" strokeWidth="1" />
      <line x1={L} x2={W - R} y1={y(b.median)} y2={y(b.median)} stroke="var(--green)" strokeWidth="1.5" strokeDasharray="5 4" />
      <line x1={L} x2={W - R} y1={y(b.tested_pli)} y2={y(b.tested_pli)} stroke="var(--red)" strokeWidth="2.5" />
      {labels.map((l) => (
        <text key={l.t} x={W - R + 6} y={l.ly + 4} fontSize={l.bold ? 11 : 10} fontWeight={l.bold ? 600 : 400} style={{ fill: l.c }}>{l.t}</text>
      ))}
    </svg>
  );
}
