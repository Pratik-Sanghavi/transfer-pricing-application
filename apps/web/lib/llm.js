// Server-only LLM layer. Live via OpenRouter when OPENROUTER_API_KEY is set;
// otherwise (or on any error) a deterministic mock, so the demo never breaks.
// Every function returns { result, source: "live" | "mock" }.
import { readInterview } from "./data";

const URL = "https://openrouter.ai/api/v1/chat/completions";
export const MODEL_FAST = process.env.OPENROUTER_MODEL_FAST || "openai/gpt-4o-mini";          // bulk screening
export const MODEL_STRONG = process.env.OPENROUTER_MODEL_STRONG || "anthropic/claude-sonnet-4.5"; // FAR + report
export const liveEnabled = () => Boolean(process.env.OPENROUTER_API_KEY);

async function chat(model, system, user, maxTokens = 2500) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "TP Copilot" },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.2,
      messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${await r.text()}`);
  return (await r.json()).choices[0].message.content;
}

function jsonFrom(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) return JSON.parse(m[1]);
  const i = Math.min(...["{", "["].map((c) => text.indexOf(c)).filter((x) => x >= 0));
  return JSON.parse(text.slice(i));
}

async function withFallback(label, live, mock) {
  if (liveEnabled()) {
    try { return { result: await live(), source: "live" }; }
    catch (e) { console.error(`[${label}] live call failed, using mock:`, e.message); }
  }
  return { result: mock(), source: "mock" };
}

// ------------------------------------------------------------------ 1. FAR extraction
const FAR_SYSTEM = `You are a senior transfer pricing consultant. Extract a functional analysis
(functions, assets, risks) from a client interview transcript, following OECD TP Guidelines
Chapter I (accurate delineation). Return ONLY JSON with keys:
entity_id, characterisation, functions (object), assets (list), risks (object),
flags_for_human_review (list of strings). Be specific; flag anything that contradicts the
entity's documented characterisation.`;

export function mockFar(entity) {
  if (entity.entity_id === "E05") {
    return JSON.parse(readInterview().match(/```json\s*([\s\S]*?)```/)[1]);
  }
  return {
    entity_id: entity.entity_id,
    characterisation: entity.role,
    functions: { key_functions: entity.key_functions },
    assets: entity.key_assets.split(";").map((s) => s.trim()),
    risks: { summary: entity.key_risks },
    flags_for_human_review: ["No interview transcript analysed — pre-filled from ERP entity master."],
  };
}

export const extractFar = (transcript, entity) =>
  withFallback("far",
    async () => {
      if (!transcript?.trim()) throw new Error("empty transcript");
      return jsonFrom(await chat(MODEL_STRONG, FAR_SYSTEM, `Entity master data:\n${JSON.stringify(entity)}\n\nInterview transcript:\n${transcript}`));
    },
    () => mockFar(entity));

// ------------------------------------------------------------------ 2. Comparable screening
const SCREEN_SYSTEM = `You are a transfer pricing benchmarking analyst. For each candidate company,
decide ACCEPT or REJECT as a comparable for the tested party, applying OECD TP Guidelines
Chapter III screening: independence (no shareholder >25%), functional comparability with the
tested party's FAR, no significant owned intangibles, no persistent losses (2+ of 3 years),
same industry/market segment. Return ONLY a JSON list of objects:
{"comp_id": str, "decision": "Accept"|"Reject", "criterion": short label, "reason": one sentence}.`;

const KEYWORD_RULES = [
  [/patent|proprietary|licens/i, "Intangibles", "Owns/licenses significant intangibles; tested party owns none."],
  [/\bBPO\b|call-center|call center/i, "Functional", "BPO/call-center services are not comparable to software development."],
  [/retail|consumer/i, "Functional", "Consumer retail differs from B2B limited-risk distribution."],
  [/restructuring|persistent losses/i, "Persistent losses", "Loss-making / restructuring — not a routine return."],
  [/subsidiary of|owned by/i, "Independence", "Part of a group — fails independence screen."],
];

export function mockScreen(comps, tested) {
  return comps.map((c) => {
    let decision = "Accept", criterion = "Comparable", reason = `Independent, functionally similar to the tested party (${tested.role}).`;
    if (c.largest_shareholder_pct > 25) [decision, criterion, reason] = ["Reject", "Independence", `Largest shareholder holds ${c.largest_shareholder_pct}% (>25% threshold).`];
    else if (c.loss_years >= 2) [decision, criterion, reason] = ["Reject", "Persistent losses", `Operating losses in ${c.loss_years} of 3 years.`];
    else {
      const hit = KEYWORD_RULES.find(([re]) => re.test(c.business_description));
      if (hit) [decision, criterion, reason] = ["Reject", hit[1], hit[2]];
    }
    return { comp_id: c.comp_id, decision, criterion, reason };
  });
}

export const screenComps = (comps, tested, far) =>
  withFallback("screen",
    async () => {
      let res = jsonFrom(await chat(MODEL_FAST, SCREEN_SYSTEM,
        `Tested party:\n${JSON.stringify(tested)}\n\nApproved FAR:\n${JSON.stringify(far || {})}\n\nCandidates:\n${JSON.stringify(comps)}`));
      if (!Array.isArray(res)) res = Object.values(res).find(Array.isArray);
      return res;
    },
    () => mockScreen(comps, tested));

// ------------------------------------------------------------------ 3. Report drafting
const REPORT_SYSTEM = `You are drafting the benchmarking and compliance section of a transfer pricing
local file. Write in formal, audit-ready English with markdown headings:
1. Executive summary, 2. Functional profile & characterisation, 3. Selection of method and tested
party (explain why TNMM / CPM and why this PLI), 4. Comparable search & screening,
5. Arm's length range and results, 6. Adjustment & recommendations, 7. Compliance triggers.
Cite the regulation reference given for every conclusion (e.g. "(OECD TPG Ch. III)").
Use only the numbers provided. Mark any statutory reference that says 'verify' as [to be verified].`;

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const title = (k) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function mockReport(ctx) {
  const { entity: e, benchmark: b, far = {}, screening, triggers, year } = ctx;
  const rejected = screening.filter((s) => s.decision === "Reject");
  const L = [
    `# Transfer Pricing Local File (Draft) — ${e.entity_name}`,
    `*Fiscal year ${year} · ${e.country} · Draft generated by TP Copilot — for consultant review*`,
    "", "## 1. Executive summary",
    `${e.entity_name} is characterised as a **${far.characterisation || e.role}**. Its ${b.pli_type} for FY${year - 2}–FY${year} (weighted) is **${pct(b.tested_pli)}**, against an arm's length interquartile range of **${pct(b.lq)} – ${pct(b.uq)}** (median ${pct(b.median)}, ${b.n} comparables). ` +
      (b.outside
        ? `The result falls **outside** the range; an adjustment to the median of approximately **USD ${(b.adjustment_usd / 1e6).toFixed(2)}M** is recommended (OECD TPG Ch. III).`
        : "The result falls **within** the arm's length range (OECD TPG Ch. III)."),
    "", "## 2. Functional profile & characterisation",
    "Based on the approved functional analysis (OECD TPG Ch. I, Section D.1):",
    ...Object.entries(far.functions || {}).map(([k, v]) => `- **${title(k)}:** ${v}`),
    ...Object.entries(far.risks || {}).map(([k, v]) => `- **${title(k)}:** ${v}`),
    "", "## 3. Selection of method and tested party",
    `${e.entity_name} is the least complex party to the transaction and does not own unique intangibles, so it is selected as the tested party. The **TNMM** (the Comparable Profits Method under US Treas. Reg. §1.482-5) is selected, with **${b.pli_type_long}** as the profit level indicator, consistent with its ${b.pli_type === "OM" ? "distribution" : "service"} functions (OECD TPG Ch. II, Part III).`,
    "", "## 4. Comparable search & screening",
    `${screening.length} candidates were reviewed; **${b.n} accepted** and **${rejected.length} rejected** (OECD TPG Ch. III, Section A.4):`,
    ...rejected.map((s) => `- ${s.comp_id}: rejected — ${s.criterion}. ${s.reason}`),
    "", "## 5. Arm's length range and results",
    "| | Value |", "|---|---|",
    `| Lower quartile | ${pct(b.lq)} |`, `| Median | ${pct(b.median)} |`, `| Upper quartile | ${pct(b.uq)} |`,
    `| Tested party (weighted) | ${pct(b.tested_pli)} |`, `| Tested party FY${year} | ${pct(b.current_pli)} |`,
    "", "## 6. Adjustment & recommendations",
    b.outside
      ? `Adjust FY${year} results to the median: approximately **USD ${(b.adjustment_usd / 1e6).toFixed(2)}M** (local currency ${(b.adjustment_local / 1e6).toFixed(1)}M).`
      : "No adjustment required.",
    ...(far.flags_for_human_review || []).map((f) => `- Review point: ${f}`),
    "", "## 7. Compliance triggers",
    ...triggers.map((t) => `- **[${t.severity}] ${t.trigger}** — ${t.detail} *Action:* ${t.action} *(${t.reference}${/verify/i.test(t.reference) ? " [to be verified]" : ""})*`),
    "", "---", "*Thresholds and statutory references are illustrative for this prototype.*",
  ];
  return L.join("\n");
}

export const draftReport = (ctx) =>
  withFallback("report",
    () => chat(MODEL_STRONG, REPORT_SYSTEM, JSON.stringify(ctx), 4000),
    () => mockReport(ctx));
