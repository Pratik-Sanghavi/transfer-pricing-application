# @tp/web

Next.js 16 (App Router) UI for TP Copilot. Run from the repo root with `npm run dev`, or here with `npm run dev -w apps/web`.

- `data/` synthetic Novatek Group CSVs + Germany CFO interview (mock ERP extract)
- `lib/data.js` server-side CSV loader (swap for a real ERP connector)
- `lib/rules.js` rule engine, IQR/benchmark math, what-if shock (runs in the browser; candidate for `packages/`)
- `lib/llm.js` OpenRouter calls (FAR extraction, comp screening, report) with mock fallback
- `app/api/{far,screen,report}` server routes, keep the API key off the client
- `components/` Dashboard, FlowGraph, FAR, Benchmark, RangeChart, Report, Audit

Env vars: see `.env.example`.
