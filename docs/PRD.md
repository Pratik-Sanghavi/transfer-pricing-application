# Product Requirements Document: Graph-Native Transfer Pricing Copilot

## 1. Product summary

**One-line pitch:** A transfer-pricing copilot that watches a client group's intercompany transactions, flags compliance triggers, and drafts a defensible TNMM benchmark, with every conclusion traced to the underlying regulation.

The product demonstrates one complete, reviewable workflow for a fictional multinational group: ingest an intercompany transaction export; visualize the group and risk signals; pre-fill a functional analysis; recommend a transfer-pricing method and PLI; screen comparable companies; calculate an arm's-length range and adjustment; and create a cited draft benchmarking section.

The product is deliberately narrow. It proves one end-to-end local-file/TNMM use case deeply rather than presenting disconnected compliance modules.

## 2. Problem

Transfer-pricing teams must turn dispersed transaction data, functional facts, regulatory requirements, and comparable-company financials into a defensible conclusion. The work is slow, difficult to audit, and often starts with manual data collection. Existing AI experiences risk producing untraceable recommendations that a reviewer or tax authority cannot validate.

## 3. Goals

- Detect material intercompany transaction and compliance triggers from a client dataset.
- Make the group structure, transaction flows, rules, and conclusions inspectable in a graph.
- Keep a consultant in control of the functional analysis (FAR), method selection, comparable screening, and final report.
- Calculate a transparent multi-year weighted interquartile range and median adjustment.
- Produce a concise, cited local-file benchmarking draft.
- Demonstrate how confidential financial data can remain in a dedicated deployment environment.

## 4. Non-goals

- Filing a tax return or producing a complete local file, master file, CbCR, or Pillar Two calculation.
- Replacing legal or tax advice.
- Connecting to a production ERP, commercial comparable database, or regulatory content feed during the hackathon.
- Making autonomous final method, adjustment, or filing decisions.

## 5. Target users

| User | Need | Product outcome |
| --- | --- | --- |
| Transfer-pricing consultant | Rapidly develop a defensible first-cut analysis | Reviews AI proposals and produces the cited benchmark draft |
| In-house tax manager | See exposure across group entities and transactions | Identifies flagged flows, deadlines, and likely adjustments |
| Reviewer / audit team | Understand why a conclusion was reached | Sees citations, calculations, source data, and human overrides |

## 6. Primary demo scenario

**Fictional group:** A US parent owns a Mexico contract manufacturer and an India service provider.

**Demo trigger:** The Mexico entity's operating margin falls below the benchmark range after a new intercompany transaction type is recorded. The India service provider also has a local-file due-date reminder.

**Happy path:**

1. A consultant uploads or opens a mock ERP CSV export.
2. The dashboard displays legal entities and intercompany edges in Neo4j; the Mexico flow is red and the India deadline is amber.
3. The consultant opens the Mexico case. The system shows the transaction facts and linked rules.
4. A mock PLAUD interview transcript is used to pre-fill the FAR form. The consultant edits and approves it.
5. The copilot recommends the tested party, TNMM/CPM method, and operating-margin PLI with a written rationale and citations.
6. The copilot screens a pre-curated comparable set, recording an accept/reject reason for each company.
7. The benchmark engine calculates the three-year weighted IQR, median, tested-party result, and required adjustment.
8. The consultant uses a what-if control to lower Mexico's margin by 2% and sees the range and adjustment update.
9. The system generates a draft local-file benchmarking section with citations and an audit log of AI proposals and human changes.

## 7. Functional requirements

### FR-1: Mock data intake

- Load a bundled CSV or uploaded CSV for legal entities, intercompany transactions, financials, and reporting deadlines.
- Use a predefined comparable-company dataset with business descriptions and three years of financial data.
- Clearly label all thresholds, rules, and company data as illustrative demo data.

### FR-2: Group graph and trigger dashboard

- Represent legal entities as nodes and intercompany transactions as directed edges.
- Link entities and transaction types to jurisdiction and regulation-rule nodes.
- Display a graph plus a table view.
- Flag at least: margin outside range, new intercompany transaction type, and local-file due date.
- Allow a user to open a trigger and inspect its source transaction, rule, citation, and recommended next action.

### FR-3: Regulation rule store

- Maintain a hand-authored rules table for OECD, US, Mexico, and India requirements.
- Each rule must contain an ID, jurisdiction, trigger condition, recommended action, source citation, and demo/illustrative disclaimer where relevant.
- Support graph retrieval of rules linked to a selected entity, transaction, or conclusion.

### FR-4: FAR human-in-the-loop workflow

- Accept a mock interview transcript, including one recorded PLAUD interview if available.
- Use an LLM to draft functions, assets, and risks for each counterparty.
- Present draft fields as editable suggestions, never final facts.
- Require consultant approval before method selection and report generation.
- Record field-level edits and approvals in the audit trail.

### FR-5: Method and PLI recommendation

- Recommend a tested party, method, and PLI from the approved FAR and transaction facts.
- Explain the recommendation in plain language, including why the selected party is the least complex.
- Support TNMM terminology and note that the analogous US approach is commonly called CPM.
- For the demo, support operating margin for a routine distributor/manufacturer and net cost plus markup for a service provider.
- Attach regulation citations to the recommendation.

### FR-6: Comparable screening and benchmark

- Screen approximately 20 curated comparable companies.
- Use an LLM to propose accept/reject decisions using the approved FAR, business description, and industry facts.
- Require a structured, visible reason for every decision; the consultant can override it.
- Calculate a multi-year weighted result for accepted comparables.
- Calculate the 25th percentile, median, and 75th percentile; compare the tested party and calculate a median adjustment when outside range.
- Show all input values and formula outputs in the UI.

### FR-7: What-if analysis

- Provide a simple control to change the tested-party margin by at least +/- 2 percentage points.
- Recalculate range position and adjustment immediately.
- Preserve the baseline and scenario values in the audit trail.

### FR-8: Cited report generation

- Generate a draft local-file benchmarking section, not a final legal opinion.
- Include transaction summary, FAR summary, method/PLI rationale, comparable-screening summary, benchmark calculation, conclusion, and citations.
- State any illustrative inputs and human approvals.
- Allow copy/download as Markdown or PDF if time permits.

### FR-9: Audit trail

- Record the source dataset version, triggered rules, AI proposals, consultant edits, approvals, benchmark inputs, scenario changes, and report generation event.
- Surface the audit trail from the case view and include a condensed version in the output.

## 8. Sponsor and integration plan

| Component | Role in demo | Integration boundary |
| --- | --- | --- |
| Neo4j | Group graph, rule links, triggers, and citation traversal | Legal entities, transactions, rules, cases, comparables, and audit events |
| OpenRouter | Model routing for screening, FAR drafting, and report drafting | Use a fast model for bulk screening; use a stronger model for FAR/report reasoning |
| Brave Search API | Current business-description and industry context for comparables | Optional live enrichment; retain source URLs and never treat search result text as authoritative law |
| PLAUD | Mock two-minute client FAR interview | Import transcript and pre-fill reviewable FAR suggestions |
| One compute sponsor | Confidential-deployment narrative and application hosting | Use one provider only; keep client financial data in the dedicated environment |

## 9. Data model

### Core graph labels

- `LegalEntity`: name, jurisdiction, role, tax ID (mock), fiscal year.
- `Transaction`: type, amount, currency, date, tested party, current margin.
- `Jurisdiction`: country, local-file requirement, due date.
- `Rule`: rule ID, trigger expression, action, citation, jurisdiction, illustrative flag.
- `FARAssessment`: functions, assets, risks, AI draft, approved values, approver.
- `Comparable`: company, description, industry, financials, screening status, rationale.
- `Benchmark`: PLI, years, weights, Q1, median, Q3, result, adjustment.
- `Citation`: source title, section, URL/reference, quoted proposition summary.
- `AuditEvent`: actor, timestamp, action, before/after data, linked case.

### Key relationships

- `(LegalEntity)-[:PARENT_OF]->(LegalEntity)`
- `(LegalEntity)-[:TRANSACTS_WITH]->(LegalEntity)` via a `Transaction`
- `(LegalEntity)-[:LOCATED_IN]->(Jurisdiction)`
- `(Transaction)-[:TRIGGERS]->(Rule)`
- `(Case)-[:USES_FAR]->(FARAssessment)`
- `(Case)-[:SCREENS]->(Comparable)`
- `(Case)-[:USES_BENCHMARK]->(Benchmark)`
- `(Conclusion)-[:SUPPORTED_BY]->(Citation)`
- `(AuditEvent)-[:RELATES_TO]->(Case)`

## 10. AI behavior and guardrails

- AI output is always framed as a proposal, draft, or explanation—not tax advice or an autonomous determination.
- Every method recommendation and comparable decision must include an explanation and at least one linked citation/rule where applicable.
- The UI must distinguish client-provided facts, mock illustrative data, retrieved context, and AI inference.
- Human approval is required before a final benchmark conclusion or report is generated.
- Do not send raw confidential client data to public tools in a production deployment; use the dedicated-environment narrative in the demo.

## 11. Success metrics

- A reviewer can complete the Mexico case from trigger to cited draft in under five minutes.
- Every shown conclusion has a visible reasoning chain and at least one citation.
- Every comparable has an accept/reject status and explanation.
- The what-if scenario recalculates in under one second for the mock dataset.
- The demo completes with no manual database query or hidden spreadsheet calculation.

## 12. Acceptance criteria

- [ ] Mock dataset loads and creates a graph with the three legal entities and intercompany edges.
- [ ] At least three trigger types appear, including a red Mexico margin flag.
- [ ] FAR draft can be edited and approved.
- [ ] TNMM/CPM and PLI recommendation shows reasoning and a citation.
- [ ] At least 15 comparables can be screened, with decision reasons.
- [ ] IQR, median, tested-party result, and adjustment are shown and mathematically reproducible.
- [ ] What-if margin control updates the conclusion.
- [ ] Draft report includes sources, assumptions, and an audit-trail summary.
- [ ] No production credentials or client data are committed to source control.

## 13. Three-hour delivery plan

| Time | Deliverable |
| --- | --- |
| 0:00-0:30 | Mock CSVs, rules JSON, comparable set, Neo4j schema, and app shell |
| 0:30-1:45 | Graph trigger dashboard, FAR review form, method/PLI logic, and IQR math |
| 1:45-2:30 | OpenRouter screening/report flows, citation display, and audit events |
| 2:30-3:00 | One-path polish, what-if demo, rehearsal, and future-scope slide |

## 14. Future scope

- Production ERP/connectors and commercial comparable-data providers.
- Full local-file, master-file, CbCR, and Pillar Two workflows.
- Country-specific rule packs and regulatory update monitoring.
- External secret management and enterprise identity controls.
- Multi-agent screening orchestration and reviewer assignment.
- Market/digital-presence enrichment through Similarweb or equivalent sources.
