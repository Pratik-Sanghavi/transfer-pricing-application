---
title: "Transfer Pricing Documentation: Local File"
subtitle: "{{entity.entity_name}} · Fiscal year ended {{fiscal_year_end_label}}"
---

{{!--
TP Copilot local file template (Handlebars).
  Plain double-brace fields are data-bound: filled deterministically from the case context (local_file_fields.json, data_fields).
  Fields prefixed "ai." are narrative slots written by the model under local_file_fields.json, ai_slots.
  Block "each" tags repeat table rows. Helpers: pct, pct2, money, num, upper, date.
  Never let the model write numbers into data-bound fields; numbers come from the engine.
--}}

# Cover

| | |
|---|---|
| **Taxpayer** | {{entity.entity_name}} |
| **Jurisdiction** | {{entity.country}} |
| **Group** | {{group.name}} (ultimate parent: {{group.parent_name}}, {{group.parent_country}}) |
| **Fiscal year** | FY{{year}} (year end: {{entity.fiscal_year_end}}) |
| **Tested transaction(s)** | {{tested.transaction_summary}} |
| **Method / PLI** | {{benchmark.method}} / {{benchmark.pli_type_long}} |
| **Prepared by** | {{prepared_by}} |
| **Status** | {{status}} · Generated {{date generated_at}} by TP Copilot |

> This document is a draft prepared with AI assistance. All conclusions were proposed by the system and approved by the consultant named above. Thresholds, rules and data marked *illustrative* are not tax advice.

# 1. Executive summary

{{ai.executive_summary}}

| Item | Result |
|---|---|
| Tested party | {{entity.entity_name}} ({{far.characterisation}}) |
| Controlled transaction | {{tested.transaction_summary}} |
| Transfer pricing method | {{benchmark.method}} ({{benchmark.method_us_equivalent}} under US regulations) |
| Profit level indicator | {{benchmark.pli_type_long}} |
| Tested party result (FY{{year}}) | {{pct benchmark.current_pli}} |
| Tested party result (weighted {{benchmark.years_label}}) | {{pct benchmark.tested_pli}} |
| Arm's length interquartile range | {{pct benchmark.lq}} to {{pct benchmark.uq}} (median {{pct benchmark.median}}, {{benchmark.n}} comparables) |
| Conclusion | **{{benchmark.conclusion_label}}** |
| Adjustment to median | {{money benchmark.adjustment_local entity.currency}} (≈ {{money benchmark.adjustment_usd "USD"}}) |

# 2. Scope and regulatory framework

## 2.1 Purpose and scope

{{ai.scope_purpose}}

## 2.2 Applicable rules

This analysis applies the arm's length principle as set out in the OECD Transfer Pricing Guidelines for Multinational Enterprises and Tax Administrations and the local rules of {{entity.country}}. The rules evaluated by TP Copilot for this entity are:

| Rule | Jurisdiction | Requirement | Reference |
|---|---|---|---|
{{#each rules_applied}}
| {{rule_id}} | {{jurisdiction}} | {{trigger_name}} | {{reference}} |
{{/each}}

## 2.3 Documentation thresholds and deadlines

{{ai.thresholds_and_deadlines}}

# 3. The local entity

## 3.1 Business description

{{ai.entity_business_description}}

| Attribute | Detail |
|---|---|
| Legal name | {{entity.entity_name}} |
| Role in the group | {{entity.role}} |
| Ownership | {{entity.ownership_pct}}% held by {{group.parent_name}} |
| Headcount | {{num entity.headcount}} |
| Functional currency | {{entity.currency}} |

## 3.2 Management structure and reporting lines

{{ai.management_structure}}

## 3.3 Restructurings and intangible transfers during the year

{{ai.restructurings}}

# 4. Group and industry overview

## 4.1 The group

{{ai.group_overview}}

| Entity | Country | Role |
|---|---|---|
{{#each group.entities}}
| {{entity_name}} | {{country}} | {{role}} |
{{/each}}

## 4.2 Industry analysis

{{ai.industry_analysis}}

## 4.3 Key value drivers

{{ai.value_drivers}}

# 5. Controlled transactions

## 5.1 Summary of intercompany transactions (FY{{year}})

| ID | Counterparty | Direction | Type | Amount ({{entity.currency}}) | Amount (USD) | Pricing policy | Agreement |
|---|---|---|---|---:|---:|---|---|
{{#each transactions}}
| {{txn_id}} | {{counterparty_name}} | {{direction}} | {{transaction_type}} | {{num amount_local}} | {{num amount_usd}} | {{pricing_policy}} | {{agreement_label}} |
{{/each}}

## 5.2 Description of the tested transaction

{{ai.tested_transaction_description}}

## 5.3 Intercompany agreements

{{ai.intercompany_agreements}}

# 6. Functional analysis

The functional analysis follows OECD Guidelines Chapter I, Section D.1 (accurate delineation of the transaction). It is based on the interview recorded on {{date far.interview_date}} with {{far.interviewee}} and was approved by {{far.approved_by}} on {{date far.approved_at}}.

## 6.1 Functions performed

| Function | {{entity.entity_name}} | {{group.parent_name}} | Notes |
|---|:---:|:---:|---|
{{#each far.functions_table}}
| {{function}} | {{tested_party}} | {{counterparty}} | {{note}} |
{{/each}}

*Legend: ● primary responsibility · ◐ shared or supporting · — not performed*

{{ai.functions_narrative}}

## 6.2 Assets employed

{{ai.assets_narrative}}

## 6.3 Risks assumed

Risks are analysed using the six-step framework in OECD Guidelines Chapter I, D.1.2.1: identification, contractual assumption, functional control, financial capacity, consistency of conduct, and allocation.

| Risk | Contractually borne by | Control exercised by | Financial capacity | Conclusion |
|---|---|---|---|---|
{{#each far.risks_table}}
| {{risk}} | {{contractual}} | {{control}} | {{capacity}} | {{conclusion}} |
{{/each}}

{{ai.risks_narrative}}

## 6.4 Characterisation

{{ai.characterisation}}

## 6.5 Points raised for consultant review

{{#each far.flags_for_human_review}}
- {{this}}
{{/each}}

# 7. Selection of the transfer pricing method

## 7.1 Methods considered

| Method | Applied? | Reason |
|---|:---:|---|
| Comparable Uncontrolled Price (CUP) | {{methods.cup.applied}} | {{methods.cup.reason}} |
| Resale Price Method | {{methods.rpm.applied}} | {{methods.rpm.reason}} |
| Cost Plus Method | {{methods.cpm_cost_plus.applied}} | {{methods.cpm_cost_plus.reason}} |
| Transactional Net Margin Method (TNMM) | {{methods.tnmm.applied}} | {{methods.tnmm.reason}} |
| Profit Split Method | {{methods.psm.applied}} | {{methods.psm.reason}} |

{{ai.method_selection}}

## 7.2 Selection of the tested party

{{ai.tested_party_selection}}

## 7.3 Selection of the profit level indicator

{{ai.pli_selection}}

# 8. Economic analysis

## 8.1 Search strategy

| Parameter | Value |
|---|---|
| Database(s) | {{search.databases}} |
| Search date | {{date search.date}} |
| Geography | {{search.geography}} |
| Industry codes / keywords | {{search.industry_codes}} |
| Years analysed | {{benchmark.years_label}} |
| Independence criterion | {{search.independence_criterion}} |

{{ai.search_strategy}}

## 8.2 Screening

| Step | Criterion | Companies remaining |
|---|---|---:|
{{#each screening_funnel}}
| {{step}} | {{criterion}} | {{num remaining}} |
{{/each}}

Each candidate's accept or reject decision was proposed by the model with a stated reason and reviewed by the consultant ({{screening_overrides}} override(s)). The full matrix is in Appendix A.

## 8.3 Final comparable set

| ID | Company | Country | {{benchmark.pli_type}} ({{benchmark.years_label}} weighted) |
|---|---|---|---:|
{{#each accepted_comparables}}
| {{comp_id}} | {{company_name}} | {{country}} | {{pct weighted_pli}} |
{{/each}}

## 8.4 Arm's length range

| Statistic | {{benchmark.pli_type}} |
|---|---:|
| Number of comparables | {{benchmark.n}} |
| Lower quartile | {{pct benchmark.lq}} |
| Median | {{pct benchmark.median}} |
| Upper quartile | {{pct benchmark.uq}} |

{{ai.range_interpretation}}

# 9. Results and conclusion

## 9.1 Tested party results

| Fiscal year | Revenue ({{entity.currency}}) | Total costs ({{entity.currency}}) | Operating profit ({{entity.currency}}) | {{benchmark.pli_type}} |
|---|---:|---:|---:|---:|
{{#each tested_financials}}
| FY{{fiscal_year}} | {{num revenue}} | {{num total_costs}} | {{num operating_profit}} | {{pct pli}} |
{{/each}}
| **Weighted** | | | | **{{pct benchmark.tested_pli}}** |

## 9.2 Comparison with the range

{{ai.results_comparison}}

## 9.3 Adjustment

| Item | Value |
|---|---:|
| PLI base, FY{{year}} ({{entity.currency}}) | {{num benchmark.pli_base_local}} |
| Tested party PLI, FY{{year}} | {{pct benchmark.current_pli}} |
| Target PLI (median) | {{pct benchmark.median}} |
| Adjustment ({{entity.currency}}) | {{money benchmark.adjustment_local entity.currency}} |
| Adjustment (USD) | {{money benchmark.adjustment_usd "USD"}} |

## 9.4 Conclusion

{{ai.conclusion}}

# 10. Compliance triggers and recommendations

| Severity | Rule | Finding | Recommended action | Reference |
|---|---|---|---|---|
{{#each triggers}}
| {{severity}} | {{rule_id}} | {{detail}} | {{action}} | {{reference}} |
{{/each}}

{{ai.recommendations}}

# Appendix A: Comparable screening matrix

| ID | Company | Decision (AI) | Final decision | Criterion | Reason |
|---|---|---|---|---|---|
{{#each screening}}
| {{comp_id}} | {{company_name}} | {{ai_decision}} | {{final_decision}} | {{criterion}} | {{reason}} |
{{/each}}

# Appendix B: Audit trail

| Time | Step | Detail | Changed by consultant? |
|---|---|---|---|
{{#each audit}}
| {{time}} | {{step}} | {{detail}} | {{changed_label}} |
{{/each}}

# Appendix C: Assumptions and limitations

{{ai.assumptions_limitations}}

# Appendix D: Glossary

| Term | Meaning |
|---|---|
| Arm's length principle | Related companies must price transactions as unrelated parties would. |
| Tested party | The less complex party whose profit is compared with comparables. |
| TNMM / CPM | Compares the tested party's net profit margin with comparable companies' margins. |
| PLI | Profit level indicator: the margin ratio being compared (e.g. operating margin, net cost plus). |
| Interquartile range | The middle 50% of the comparables' results. |
| FAR analysis | Analysis of the functions performed, assets used and risks assumed. |
