// TP rule engine (isomorphic: runs in the browser for instant what-if, and on the server).
// Every rule: (d, year) => Trigger[]. Metadata (severity, action, citation) comes from tp_rules.csv.
// Thresholds are ILLUSTRATIVE for the hackathon demo.

export const CURRENT_YEAR = 2025;
export const SEV_ORDER = { High: 0, Medium: 1, Low: 2, Info: 3 };
export const BENCHMARKS = {
  E02: { compKey: "comparables_services", pli: "NCP" },
  E05: { compKey: "comparables_distributors", pli: "OM" },
};
export const PLI_LONG = {
  NCP: "Net Cost Plus (operating profit / total costs)",
  OM: "Operating Margin (operating profit / sales)",
};

const sum = (arr, k) => arr.reduce((s, r) => s + (Number(r[k]) || 0), 0);
export const fin = (d, eid, year) =>
  year == null ? d.financials.filter((r) => r.entity_id === eid)
               : d.financials.find((r) => r.entity_id === eid && r.fiscal_year === year);
export const entity = (d, eid) => d.entities.find((e) => e.entity_id === eid);
export const pli = (row, t) => row.operating_profit / (t === "NCP" ? row.total_costs : row.revenue);

export function weightedPli(d, eid, t) {
  const f = fin(d, eid);
  return sum(f, "operating_profit") / sum(f, t === "NCP" ? "total_costs" : "revenue");
}

// numpy.percentile default (linear interpolation)
export function percentile(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  const idx = ((s.length - 1) * p) / 100, lo = Math.floor(idx), hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export function compSummary(comps, t) {
  const g = {};
  for (const r of comps) {
    const c = (g[r.comp_id] ??= {
      comp_id: r.comp_id, company_name: r.company_name, country: r.country,
      business_description: r.business_description, largest_shareholder_pct: r.largest_shareholder_pct,
      loss_years: 0, revenue: 0, total_costs: 0, op: 0,
    });
    c.revenue += r.revenue_musd; c.total_costs += r.total_costs_musd; c.op += r.operating_profit_musd;
    if (r.operating_profit_musd < 0) c.loss_years++;
  }
  return Object.values(g).map((c) => ({ ...c, weighted_pli: c.op / (t === "NCP" ? c.total_costs : c.revenue) }));
}

// Deterministic screens. Qualitative screens (IP, BPO, retail...) are the LLM's job.
export const quantScreen = (comps, maxSh = 25, maxLoss = 1) =>
  compSummary(comps, "OM").filter((c) => c.largest_shareholder_pct <= maxSh && c.loss_years <= maxLoss).map((c) => c.comp_id);

export function compRange(comps, t, acceptedIds) {
  let s = compSummary(comps, t);
  if (acceptedIds?.length) s = s.filter((c) => acceptedIds.includes(c.comp_id));
  const p = s.map((c) => c.weighted_pli);
  return {
    lq: percentile(p, 25), median: percentile(p, 50), uq: percentile(p, 75), n: p.length,
    compPlis: Object.fromEntries(s.map((c) => [c.comp_id, c.weighted_pli])),
  };
}

const policyMarkup = (txt) => { const m = String(txt).match(/(\d+(?:\.\d+)?)\s*%/); return m ? Number(m[1]) / 100 : null; };
const pct = (x, dp = 1) => `${(x * 100).toFixed(dp)}%`;
const m$ = (x, dp = 2) => (x / 1e6).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

function trig(d, ruleId, entityId, year, detail, metrics = {}, severity) {
  const meta = d.rulesMeta[ruleId];
  return {
    rule_id: ruleId, entity_id: entityId, fiscal_year: year, jurisdiction: meta.jurisdiction,
    trigger: meta.trigger_name, severity: severity || meta.severity, detail,
    action: meta.action, reference: meta.reference, metrics,
  };
}

const involving = (d, eid, year) =>
  d.ic_transactions.filter((t) => t.fiscal_year === year && (t.provider_entity === eid || t.recipient_entity === eid));

// ------------------------------------------------------------------ rules
function r01(d, year, accepted) {
  const out = [];
  for (const [eid, { compKey, pli: t }] of Object.entries(BENCHMARKS)) {
    const comps = d[compKey];
    const ids = accepted?.[eid]?.length ? accepted[eid] : quantScreen(comps);
    const rng = compRange(comps, t, ids);
    const tp = weightedPli(d, eid, t);
    if (tp < rng.lq || tp > rng.uq) {
      const row = fin(d, eid, year);
      const adjLocal = (rng.median - pli(row, t)) * (t === "NCP" ? row.total_costs : row.revenue);
      const adjUsd = adjLocal / row.fx_per_usd;
      out.push(trig(d, "R01", eid, year,
        `${t} weighted ${pct(tp)} vs IQR ${pct(rng.lq)}–${pct(rng.uq)} (median ${pct(rng.median)}, ${rng.n} comps). FY${year} adjustment to median ≈ USD ${m$(adjUsd)}M.`,
        { pli_type: t, tested_pli: tp, lq: rng.lq, median: rng.median, uq: rng.uq, n: rng.n, adjustment_local: adjLocal, adjustment_usd: adjUsd }));
    }
  }
  return out;
}

function r02(d, year) {
  return d.entities
    .filter((e) => /limited-risk/i.test(e.functional_profile + " " + e.role))
    .flatMap((e) => {
      const row = fin(d, e.entity_id, year);
      return row.operating_profit < 0
        ? [trig(d, "R02", e.entity_id, year,
            `${e.entity_name} reports operating loss of ${row.currency} ${m$(row.operating_profit, 1)}M (OM ${pct(row.operating_profit / row.revenue)}); royalty expense ${row.currency} ${m$(row.royalty_expense, 1)}M this year.`,
            { operating_profit: row.operating_profit, royalty_expense: row.royalty_expense })]
        : [];
    });
}

function r03(d, year) {
  const thr = Number(d.rulesMeta.R03.threshold);
  const providers = [...new Set(d.ic_transactions.filter((t) => t.fiscal_year === year && t.transaction_type === "Services - low value-adding").map((t) => t.provider_entity))];
  return providers.flatMap((eid) => {
    const mk = pli(fin(d, eid, year), "NCP");
    return Math.abs(mk - thr) > 0.0005 ? [trig(d, "R03", eid, year, `Actual markup ${pct(mk, 2)} vs 5% simplified approach.`, { actual_markup: mk })] : [];
  });
}

function r04(d, year) {
  return d.ic_transactions.filter((t) => t.fiscal_year === year && t.written_agreement === "N").map((r) =>
    trig(d, "R04", r.recipient_entity, year,
      `${r.txn_id}: ${r.description} (${r.provider_entity}→${r.recipient_entity}, USD ${m$(r.amount_usd)}M) has no written agreement${r.first_year === year ? " — NEW this year." : ` (since FY${r.first_year}).`}`,
      { txn_id: r.txn_id, amount_usd: r.amount_usd }, r.first_year === year ? "High" : "Medium"));
}

function r05(d, year) {
  const [lo, hi] = String(d.rulesMeta.R05.threshold).split(";").map(Number);
  return d.ic_transactions.filter((t) => t.fiscal_year === year && /loan/i.test(t.transaction_type)).flatMap((r) => {
    const m = String(r.notes).match(/USD\s*([\d,]+)/);
    if (!m) return [];
    const principal = Number(m[1].replace(/,/g, "")), rate = r.amount_usd / principal;
    return rate < lo || rate > hi
      ? [trig(d, "R05", r.recipient_entity, year, `${r.txn_id}: implied rate ${pct(rate, 2)} on USD ${m$(principal, 0)}M vs illustrative market band ${pct(lo)}–${pct(hi)}.`, { txn_id: r.txn_id, rate, principal_usd: principal })]
      : [];
  });
}

function r06(d, year) {
  const total = sum(involving(d, "E01", year), "amount_usd"), thr = Number(d.rulesMeta.R06.threshold);
  return total > thr ? [trig(d, "R06", "E01", year, `US parent IC transactions USD ${m$(total, 1)}M exceed USD ${m$(thr, 0)}M — contemporaneous documentation needed.`, { total_usd: total })] : [];
}

function r07(d, year) {
  const fx = fin(d, "E02", year).fx_per_usd;
  const totalInr = sum(involving(d, "E02", year), "amount_usd") * fx, thr = Number(d.rulesMeta.R07.threshold);
  return totalInr > thr ? [trig(d, "R07", "E02", year, `International transactions INR ${(totalInr / 1e7).toFixed(1)} crore exceed INR ${thr / 1e7} crore threshold.`, { total_inr: totalInr })] : [];
}

function r08(d, year) {
  return d.ic_transactions
    .filter((t) => t.fiscal_year === year && t.recipient_entity === "E02" && /management fee/i.test(t.transaction_type) && /No benefit-test/i.test(t.notes))
    .map((r) => trig(d, "R08", "E02", year, `${r.txn_id}: management fee USD ${m$(r.amount_usd)}M with no benefit-test evidence on file.`, { txn_id: r.txn_id }));
}

function r09(d, year) {
  const tol = Number(d.rulesMeta.R09.threshold);
  const t = d.ic_transactions.find((x) => x.fiscal_year === year && x.provider_entity === "E02");
  const pol = policyMarkup(t?.pricing_policy), act = pli(fin(d, "E02", year), "NCP");
  return pol != null && Math.abs(act - pol) > tol
    ? [trig(d, "R09", "E02", year, `Actual markup ${pct(act)} vs policy ${pct(pol, 0)} (${((act - pol) * 100).toFixed(1)} pp). Year-end true-up likely missed.`, { actual_markup: act, policy_markup: pol })]
    : [];
}

// Checks every open year on file, not only the current one.
function r10(d) {
  const [rc, ra] = String(d.rulesMeta.R10.threshold).split(";").map(Number);
  return d.entities.filter((e) => /maquila/i.test(e.role)).flatMap((e) =>
    fin(d, e.entity_id).flatMap((row) => {
      const req = Math.max(rc * row.total_costs, ra * row.total_operating_assets), short = req - row.operating_profit;
      return short > 0.001 * req
        ? [trig(d, "R10", e.entity_id, row.fiscal_year,
            `FY${row.fiscal_year}: operating profit ${pct(row.operating_profit / row.total_costs, 2)} of costs; safe harbor requires the higher of ${pct(rc)} of costs / ${pct(ra)} of assets. Shortfall MXN ${m$(short, 1)}M (≈ USD ${m$(short / row.fx_per_usd)}M).`,
            { required_op: req, actual_op: row.operating_profit, shortfall_local: short, shortfall_usd: short / row.fx_per_usd })]
        : [];
    }));
}

function r11(d, year) {
  return involving(d, "E05", year).filter((t) => t.first_year === year)
    .map((r) => trig(d, "R11", "E05", year, `${r.txn_id}: ${r.description} is new in FY${year} — extraordinary transaction documentation due.`, { txn_id: r.txn_id }));
}

function r12(d, year) {
  const thr = Number(d.rulesMeta.R12.threshold), mk = pli(fin(d, "E03", year), "NCP");
  return mk < thr - 0.0005 ? [trig(d, "R12", "E03", year, `Markup ${pct(mk, 2)} below ${pct(thr, 0)}.`, { markup: mk })] : [];
}

export function groupRevenueEur(d, year) {
  const f = d.financials.filter((r) => r.fiscal_year === year);
  const extUsd = f.reduce((s, r) => s + (r.revenue - r.related_party_revenue) / r.fx_per_usd, 0);
  return extUsd * f.find((r) => r.currency === "EUR").fx_per_usd;
}

function r13r14(d, year) {
  const rev = groupRevenueEur(d, year);
  return ["R13", "R14"].filter((id) => rev >= Number(d.rulesMeta[id].threshold)).map((id) =>
    trig(d, id, "GROUP", year, `Group external revenue ≈ EUR ${m$(rev, 0)}M ≥ EUR ${m$(Number(d.rulesMeta[id].threshold), 0)}M.`, { group_revenue_eur: rev }));
}

const RULES = [r02, r03, r04, r05, r06, r07, r08, r09, r10, r11, r12, r13r14];

export function runAll(d, year = CURRENT_YEAR, accepted = null) {
  const out = [...r01(d, year, accepted), ...RULES.flatMap((r) => r(d, year))];
  return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.entity_id.localeCompare(b.entity_id) || a.rule_id.localeCompare(b.rule_id));
}

export function entityStatus(d, triggers) {
  const colour = { High: "red", Medium: "amber", Low: "amber", Info: "green" }, rank = { red: 0, amber: 1, green: 2 };
  const status = Object.fromEntries(d.entities.map((e) => [e.entity_id, "green"]));
  for (const t of triggers) {
    if (t.entity_id in status && rank[colour[t.severity]] < rank[status[t.entity_id]]) status[t.entity_id] = colour[t.severity];
  }
  return status;
}

// What-if slider: shift an entity's operating profit by ±x pp of its PLI base.
export function applyMarginShock(d, eid, year, deltaPp) {
  if (!eid || !deltaPp) return d;
  const t = BENCHMARKS[eid]?.pli || "NCP";
  return {
    ...d,
    financials: d.financials.map((r) => {
      if (r.entity_id !== eid || r.fiscal_year !== year) return r;
      const shift = (t === "OM" ? r.revenue : r.total_costs) * deltaPp / 100;
      return { ...r, operating_profit: r.operating_profit + shift, opex: r.opex - shift, total_costs: r.total_costs - shift };
    }),
  };
}

// Benchmark summary for one tested party (used by the Benchmark + Report tabs).
export function benchmark(d, eid, acceptedIds, year = CURRENT_YEAR) {
  const { compKey, pli: t } = BENCHMARKS[eid];
  const rng = compRange(d[compKey], t, acceptedIds);
  const tp = weightedPli(d, eid, t), row = fin(d, eid, year);
  const outside = tp < rng.lq || tp > rng.uq;
  const adjLocal = outside ? (rng.median - pli(row, t)) * (t === "NCP" ? row.total_costs : row.revenue) : 0;
  return { ...rng, pli_type: t, pli_type_long: PLI_LONG[t], tested_pli: tp, current_pli: pli(row, t), outside,
           adjustment_local: adjLocal, adjustment_usd: adjLocal / row.fx_per_usd };
}
