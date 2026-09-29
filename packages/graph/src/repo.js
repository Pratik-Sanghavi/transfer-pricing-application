// Neo4j repository: schema, seeding, reads for the app, and case-state writes.
//
// Graph model (see docs/PRD.md §9)
//   (:LegalEntity)-[:LOCATED_IN]->(:Jurisdiction)
//   (:LegalEntity)-[:PARENT_OF {ownership_pct}]->(:LegalEntity)
//   (:LegalEntity)-[:REPORTED]->(:Financials {fiscal_year})
//   (:LegalEntity)-[:PROVIDES]->(:Transaction)-[:TO]->(:LegalEntity)
//   (:Rule)-[:APPLIES_IN]->(:Jurisdiction)
//   (:Transaction)-[:TRIGGERS {fiscal_year, severity, detail}]->(:Rule)
//   (:LegalEntity|:Case)-[:FLAGGED_BY {fiscal_year, severity, detail}]->(:Rule)
//   (:Comparable {set})-[:HAS_FINANCIALS]->(:ComparableFinancials {fiscal_year})
//   (:Case)-[:COVERS]->(:LegalEntity)
//   (:Case)-[:USES_FAR]->(:FARAssessment)-[:ASSESSES]->(:LegalEntity)
//   (:Case)-[:SCREENED {tested_entity, accept, ai_decision, criterion, reason}]->(:Comparable)
//   (:Case)-[:HAS_REPORT]->(:Report)
//   (:AuditEvent)-[:RELATES_TO]->(:Case), (:AuditEvent)-[:ABOUT]->(:LegalEntity)
//   (:Interview)-[:WITH]->(:LegalEntity)
import { run } from "./client.js";
import { runAll, CURRENT_YEAR } from "@tp/core/rules";

export const CASE_ID = `novatek-FY${CURRENT_YEAR}`;
const JURISDICTION_NAME = { US: "United States" };
const json = (v) => (v == null ? null : JSON.stringify(v));
const parse = (s) => (s ? JSON.parse(s) : null);

// ------------------------------------------------------------------ schema
const CONSTRAINTS = [
  ["le_id", "LegalEntity", "entity_id"], ["txn_id", "Transaction", "txn_id"], ["rule_id", "Rule", "rule_id"],
  ["comp_id", "Comparable", "comp_id"], ["jur_name", "Jurisdiction", "name"], ["case_id", "Case", "id"],
  ["audit_id", "AuditEvent", "id"],
];

export async function ensureSchema() {
  for (const [name, label, prop] of CONSTRAINTS) {
    await run(`CREATE CONSTRAINT ${name} IF NOT EXISTS FOR (n:${label}) REQUIRE n.${prop} IS UNIQUE`);
  }
}

// ------------------------------------------------------------------ seed
export async function seedGraph(d) {
  await ensureSchema();
  const jurisdictions = [...new Set([
    ...d.entities.map((e) => e.country),
    ...d.tp_rules.map((r) => JURISDICTION_NAME[r.jurisdiction] || r.jurisdiction),
  ])];
  await run(`UNWIND $names AS n MERGE (:Jurisdiction {name: n})`, { names: jurisdictions });

  await run(`
    UNWIND $rows AS r
    MERGE (e:LegalEntity {entity_id: r.entity_id}) SET e += r
    WITH e, r MATCH (j:Jurisdiction {name: r.country}) MERGE (e)-[:LOCATED_IN]->(j)`, { rows: d.entities });
  await run(`
    UNWIND $rows AS r
    WITH r WHERE r.parent_entity_id <> ''
    MATCH (p:LegalEntity {entity_id: r.parent_entity_id}), (c:LegalEntity {entity_id: r.entity_id})
    MERGE (p)-[rel:PARENT_OF]->(c) SET rel.ownership_pct = r.ownership_pct`, { rows: d.entities });

  await run(`
    UNWIND $rows AS r
    MATCH (e:LegalEntity {entity_id: r.entity_id})
    MERGE (f:Financials {entity_id: r.entity_id, fiscal_year: r.fiscal_year}) SET f += r
    MERGE (e)-[:REPORTED]->(f)`, { rows: d.financials });

  await run(`
    UNWIND $rows AS r
    MERGE (t:Transaction {txn_id: r.txn_id}) SET t += r
    WITH t, r
    MATCH (a:LegalEntity {entity_id: r.provider_entity}), (b:LegalEntity {entity_id: r.recipient_entity})
    MERGE (a)-[:PROVIDES]->(t) MERGE (t)-[:TO]->(b)`, { rows: d.ic_transactions });

  await run(`
    UNWIND $rows AS r
    MERGE (x:Rule {rule_id: r.rule_id}) SET x += r, x.illustrative = true
    WITH x, r MATCH (j:Jurisdiction {name: r.jur}) MERGE (x)-[:APPLIES_IN]->(j)`,
    { rows: d.tp_rules.map((r) => ({ ...r, jur: JURISDICTION_NAME[r.jurisdiction] || r.jurisdiction })) });

  for (const [set, key] of [["services", "comparables_services"], ["distributors", "comparables_distributors"]]) {
    await run(`
      UNWIND $rows AS r
      MERGE (c:Comparable {comp_id: r.comp_id})
      SET c.company_name = r.company_name, c.country = r.country, c.business_description = r.business_description,
          c.largest_shareholder_pct = r.largest_shareholder_pct, c.set = $set
      MERGE (y:ComparableFinancials {comp_id: r.comp_id, fiscal_year: r.fiscal_year}) SET y += r
      MERGE (c)-[:HAS_FINANCIALS]->(y)`, { rows: d[key], set });
  }

  if (d.sampleTranscript) {
    await run(`
      MATCH (e:LegalEntity {entity_id: 'E05'})
      MERGE (i:Interview {entity_id: 'E05'}) SET i.transcript = $t, i.source = 'PLAUD (mock)'
      MERGE (i)-[:WITH]->(e)`, { t: d.sampleTranscript });
  }

  await run(`
    MERGE (c:Case {id: $id}) SET c.client = 'Novatek Group', c.fiscal_year = $fy, c.method = 'TNMM'
    WITH c MATCH (e:LegalEntity) MERGE (c)-[:COVERS]->(e)`, { id: CASE_ID, fy: CURRENT_YEAR });

  await syncTriggers(runAll(d, CURRENT_YEAR, null));
}

export async function ensureSeeded(csvData) {
  const [{ n }] = await run(`MATCH (e:LegalEntity) RETURN count(e) AS n`);
  if (n === 0) await seedGraph(csvData);
  return n === 0;
}

// ------------------------------------------------------------------ reads
const props = async (cypher, params) => (await run(cypher, params)).map((r) => r.p);

export async function loadGraphData() {
  const [entities, financials, ic_transactions, tp_rules, services, distributors, interview] = await Promise.all([
    props(`MATCH (e:LegalEntity) RETURN properties(e) AS p ORDER BY e.entity_id`),
    props(`MATCH (:LegalEntity)-[:REPORTED]->(f:Financials) RETURN properties(f) AS p ORDER BY f.entity_id, f.fiscal_year`),
    props(`MATCH (:LegalEntity)-[:PROVIDES]->(t:Transaction) RETURN properties(t) AS p ORDER BY t.txn_id`),
    props(`MATCH (r:Rule) RETURN properties(r) AS p ORDER BY r.rule_id`),
    props(`MATCH (:Comparable {set: 'services'})-[:HAS_FINANCIALS]->(y) RETURN properties(y) AS p ORDER BY y.comp_id, y.fiscal_year`),
    props(`MATCH (:Comparable {set: 'distributors'})-[:HAS_FINANCIALS]->(y) RETURN properties(y) AS p ORDER BY y.comp_id, y.fiscal_year`),
    props(`MATCH (i:Interview {entity_id: 'E05'}) RETURN i.transcript AS p`),
  ]);
  return {
    entities, financials, ic_transactions, tp_rules,
    rulesMeta: Object.fromEntries(tp_rules.map((r) => [r.rule_id, r])),
    comparables_services: services, comparables_distributors: distributors,
    sampleTranscript: interview[0] || "",
  };
}

export async function getCaseState(caseId = CASE_ID) {
  const [fars, screens, reports, audit] = await Promise.all([
    run(`MATCH (:Case {id: $c})-[:USES_FAR]->(f:FARAssessment) RETURN f.entity_id AS eid, f.ai_json AS ai, f.approved_json AS approved`, { c: caseId }),
    run(`MATCH (:Case {id: $c})-[s:SCREENED]->(k:Comparable)
         RETURN s.tested_entity AS eid, k.comp_id AS comp_id, s.accept AS accept, s.ai_decision AS ai_decision,
                s.criterion AS criterion, s.reason AS reason ORDER BY eid, comp_id`, { c: caseId }),
    run(`MATCH (:Case {id: $c})-[:HAS_REPORT]->(r:Report) RETURN r.entity_id AS eid, r.text AS text, r.source AS source`, { c: caseId }),
    run(`MATCH (a:AuditEvent)-[:RELATES_TO]->(:Case {id: $c}) RETURN properties(a) AS p ORDER BY a.seq`, { c: caseId }),
  ]);
  const state = { far: {}, farAi: {}, screening: {}, report: {}, audit: [] };
  for (const f of fars) {
    if (f.ai) state.farAi[f.eid] = parse(f.ai);
    if (f.approved) state.far[f.eid] = parse(f.approved);
  }
  for (const { eid, ...row } of screens) (state.screening[eid] ??= []).push(row);
  for (const r of reports) state.report[r.eid] = { text: r.text, source: r.source };
  state.audit = audit.map(({ p }) => ({ time: p.time, step: p.step, entity: p.entity, detail: p.detail,
                                        ai: parse(p.ai_json), human: parse(p.human_json) }));
  return state;
}

export async function graphStats() {
  const [{ nodes }] = await run(`MATCH (n) RETURN count(n) AS nodes`);
  const [{ rels }] = await run(`MATCH ()-[r]->() RETURN count(r) AS rels`);
  return { nodes, rels };
}

// ------------------------------------------------------------------ writes
export async function saveFarProposal(eid, ai, caseId = CASE_ID) {
  await run(`
    MATCH (c:Case {id: $c}), (e:LegalEntity {entity_id: $eid})
    MERGE (f:FARAssessment {case_id: $c, entity_id: $eid})
    SET f.ai_json = $ai, f.status = 'draft', f.updated_at = $now
    MERGE (c)-[:USES_FAR]->(f) MERGE (f)-[:ASSESSES]->(e)`,
    { c: caseId, eid, ai: json(ai), now: new Date().toISOString() });
}

export async function approveFar(eid, approved, caseId = CASE_ID) {
  await run(`
    MATCH (c:Case {id: $c}), (e:LegalEntity {entity_id: $eid})
    MERGE (f:FARAssessment {case_id: $c, entity_id: $eid})
    SET f.approved_json = $approved, f.status = 'approved', f.approved_at = $now
    MERGE (c)-[:USES_FAR]->(f) MERGE (f)-[:ASSESSES]->(e)`,
    { c: caseId, eid, approved: json(approved), now: new Date().toISOString() });
}

export async function saveScreening(eid, rows, caseId = CASE_ID) {
  await run(`
    MATCH (c:Case {id: $c})
    OPTIONAL MATCH (c)-[old:SCREENED {tested_entity: $eid}]->(:Comparable)
    DELETE old
    WITH DISTINCT c
    UNWIND $rows AS r
    MATCH (k:Comparable {comp_id: r.comp_id})
    CREATE (c)-[s:SCREENED {tested_entity: $eid}]->(k)
    SET s.accept = r.accept, s.ai_decision = r.ai_decision, s.criterion = r.criterion, s.reason = r.reason`,
    { c: caseId, eid, rows: rows.map(({ comp_id, accept, ai_decision, criterion, reason }) =>
      ({ comp_id, accept: Boolean(accept), ai_decision: ai_decision || "", criterion: criterion || "", reason: reason || "" })) });
}

export async function saveReport(eid, text, source, caseId = CASE_ID) {
  await run(`
    MATCH (c:Case {id: $c})
    MERGE (r:Report {case_id: $c, entity_id: $eid})
    SET r.text = $text, r.source = $source, r.created_at = $now
    MERGE (c)-[:HAS_REPORT]->(r)`,
    { c: caseId, eid, text, source, now: new Date().toISOString() });
}

let seqCounter = 0;
export async function appendAudit(ev, caseId = CASE_ID) {
  const p = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    seq: Date.now() * 1000 + (seqCounter++ % 1000), case_id: caseId,
    time: ev.time || new Date().toLocaleTimeString(), at: new Date().toISOString(),
    step: ev.step || "", entity: ev.entity || "", detail: ev.detail || "",
    ai_json: json(ev.ai), human_json: json(ev.human),
  };
  await run(`
    MATCH (c:Case {id: $c})
    CREATE (a:AuditEvent) SET a = $p
    CREATE (a)-[:RELATES_TO]->(c)
    WITH a
    OPTIONAL MATCH (e:LegalEntity {entity_id: $eid})
    FOREACH (_ IN CASE WHEN e IS NULL THEN [] ELSE [1] END | MERGE (a)-[:ABOUT]->(e))`,
    { c: caseId, p, eid: p.entity });
}

// Triggers are stored as relationships so "which rules does this transaction trigger?" is one query.
export async function syncTriggers(triggers, caseId = CASE_ID) {
  await run(`MATCH ()-[r:TRIGGERS|FLAGGED_BY]->(:Rule) DELETE r`);
  const shape = (t) => ({ rule_id: t.rule_id, entity_id: t.entity_id, txn_id: t.metrics?.txn_id || null,
                          fiscal_year: t.fiscal_year, severity: t.severity, detail: t.detail });
  const rows = triggers.map(shape);
  await run(`
    UNWIND $rows AS t
    MATCH (x:Rule {rule_id: t.rule_id}), (tr:Transaction {txn_id: t.txn_id})
    MERGE (tr)-[r:TRIGGERS {fiscal_year: t.fiscal_year, entity_id: t.entity_id}]->(x)
    SET r.severity = t.severity, r.detail = t.detail`, { rows: rows.filter((t) => t.txn_id) });
  await run(`
    UNWIND $rows AS t
    MATCH (x:Rule {rule_id: t.rule_id}), (e:LegalEntity {entity_id: t.entity_id})
    MERGE (e)-[r:FLAGGED_BY {fiscal_year: t.fiscal_year}]->(x)
    SET r.severity = t.severity, r.detail = t.detail`, { rows: rows.filter((t) => !t.txn_id && t.entity_id !== "GROUP") });
  await run(`
    UNWIND $rows AS t
    MATCH (x:Rule {rule_id: t.rule_id}), (c:Case {id: $c})
    MERGE (c)-[r:FLAGGED_BY {fiscal_year: t.fiscal_year}]->(x)
    SET r.severity = t.severity, r.detail = t.detail`, { rows: rows.filter((t) => t.entity_id === "GROUP"), c: caseId });
}

// Re-run the rule engine against the graph (e.g. after the consultant changes the accepted comparables).
export async function recomputeTriggers(caseId = CASE_ID) {
  const [data, state] = await Promise.all([loadGraphData(), getCaseState(caseId)]);
  const accepted = Object.fromEntries(Object.entries(state.screening)
    .map(([eid, rows]) => [eid, rows.filter((r) => r.accept).map((r) => r.comp_id)]));
  await syncTriggers(runAll(data, CURRENT_YEAR, Object.keys(accepted).length ? accepted : null), caseId);
}

// Clears consultant work for the case (FAR, screening, reports, audit) but keeps client data.
export async function resetCase(caseId = CASE_ID) {
  await run(`MATCH (:Case {id: $c})-[s:SCREENED]->() DELETE s`, { c: caseId });
  await run(`MATCH (n) WHERE (n:FARAssessment OR n:Report OR n:AuditEvent) AND n.case_id = $c DETACH DELETE n`, { c: caseId });
  await recomputeTriggers(caseId);
}

// Full rebuild: wipe the graph and seed again from the CSV extract.
export async function reseed(csvData) {
  await run(`MATCH (n) DETACH DELETE n`);
  await seedGraph(csvData);
}
