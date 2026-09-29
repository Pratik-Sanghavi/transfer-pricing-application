from contextlib import asynccontextmanager
import json
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.config import Settings, get_settings
from app.database import Neo4jRepository
from app.schemas import AuditEventCreate, BenchmarkRequest, FarAIRequest, FarUpdate, ReportAIRequest, ReportRequest, ScreenAIRequest
from app.services.openrouter import far as ai_far, report as ai_report, screen as ai_screen
from app.services.benchmark import calculate_range


def repository(settings: Settings = Depends(get_settings)) -> Neo4jRepository:
    return Neo4jRepository(settings)


@asynccontextmanager
async def lifespan(app: FastAPI):
    repo = Neo4jRepository(get_settings())
    try:
        repo.verify_connectivity()
    finally:
        repo.close()
    yield


app = FastAPI(title="TP Copilot API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health(repo: Neo4jRepository = Depends(repository)):
    try:
        repo.query("RETURN 1 AS ready")
        return {"status": "ok", "database": "neo4j"}
    finally:
        repo.close()


@app.get("/api/v1/graph")
def group_graph(repo: Neo4jRepository = Depends(repository)):
    try:
        rows = repo.query("""
            MATCH (e:LegalEntity)
            OPTIONAL MATCH (e)-[t:INTERCOMPANY_TRANSACTION]->(counterparty:LegalEntity)
            RETURN collect(DISTINCT {id:e.entity_id,name:e.entity_name,country:e.country,role:e.role,tested_party:e.tested_party}) AS nodes,
                   collect(DISTINCT CASE WHEN t IS NULL THEN null ELSE {id:t.txn_id,source:e.entity_id,target:counterparty.entity_id,type:t.transaction_type,amount_usd:t.amount_usd,year:t.fiscal_year,written_agreement:t.written_agreement} END) AS edges
        """)
        graph = rows[0] if rows else {"nodes": [], "edges": []}
        graph["edges"] = [edge for edge in graph["edges"] if edge]
        return graph
    finally:
        repo.close()


@app.get("/api/v1/audit-events")
def list_audit_events(repo: Neo4jRepository = Depends(repository)):
    try:
        rows = repo.query("""
            MATCH (audit:AuditEvent)
            OPTIONAL MATCH (audit)-[:RELATES_TO]->(target)
            RETURN audit.id AS id, coalesce(audit.created_at, "") AS time,
                   coalesce(audit.step, audit.action, "Audit event") AS step,
                   coalesce(audit.entity_id, target.entity_id, "GROUP") AS entity,
                   coalesce(audit.detail, "") AS detail, audit.ai_json AS ai_json,
                   audit.human_json AS human_json
            ORDER BY time ASC
        """)
        for row in rows:
            row["ai"] = json.loads(row.pop("ai_json")) if row.get("ai_json") else None
            row["human"] = json.loads(row.pop("human_json")) if row.get("human_json") else None
        return rows
    finally:
        repo.close()


@app.post("/api/v1/audit-events")
def create_audit_event(event: AuditEventCreate, repo: Neo4jRepository = Depends(repository)):
    try:
        event_id, created_at = str(uuid4()), datetime.now(timezone.utc).isoformat()
        rows = repo.query("""
            CREATE (audit:AuditEvent {id:$id, step:$step, entity_id:$entity, detail:$detail,
                                      ai_json:$ai_json, human_json:$human_json, created_at:$created_at})
            WITH audit
            OPTIONAL MATCH (entity:LegalEntity {entity_id:$entity_id})
            FOREACH (_ IN CASE WHEN entity IS NULL THEN [] ELSE [1] END |
                CREATE (audit)-[:RELATES_TO]->(entity))
            RETURN audit.id AS id, audit.created_at AS time, audit.step AS step,
                   audit.entity_id AS entity, audit.detail AS detail,
                   audit.ai_json AS ai_json, audit.human_json AS human_json
        """, {"id": event_id, "step": event.step, "entity": event.entity, "entity_id": event.entity,
               "detail": event.detail, "ai_json": json.dumps(event.ai) if event.ai is not None else None,
               "human_json": json.dumps(event.human) if event.human is not None else None,
               "created_at": created_at})
        row = rows[0]
        row["ai"] = json.loads(row.pop("ai_json")) if row.get("ai_json") else None
        row["human"] = json.loads(row.pop("human_json")) if row.get("human_json") else None
        return row
    finally:
        repo.close()

@app.get("/api/v1/ai/status")
def ai_status(settings: Settings = Depends(get_settings)):
    return {"live": bool(settings.openrouter_api_key), "fast": settings.openrouter_model_fast, "strong": settings.openrouter_model_strong}


@app.post("/api/v1/ai/far")
def generate_far(request: FarAIRequest, settings: Settings = Depends(get_settings)):
    return ai_far(settings, request.transcript, request.entity)


@app.post("/api/v1/ai/screen")
def screen_comparables(request: ScreenAIRequest, settings: Settings = Depends(get_settings)):
    return ai_screen(settings, request.comps, request.tested, request.far)


@app.post("/api/v1/ai/report")
def generate_report(request: ReportAIRequest, settings: Settings = Depends(get_settings)):
    return ai_report(settings, request.ctx)

@app.get("/api/v1/client-data")
def client_data(repo: Neo4jRepository = Depends(repository)):
    """Return the dashboard dataset from Neo4j in the shape consumed by the web UI."""
    try:
        entities = repo.query("MATCH (e:LegalEntity) RETURN e {.*} AS entity ORDER BY e.entity_id")
        financials = repo.query("""
            MATCH (:LegalEntity)-[:REPORTED_RESULT]->(f:FinancialResult)
            RETURN f {.*} AS financial
            ORDER BY financial.entity_id, financial.fiscal_year
        """)
        transactions = repo.query("""
            MATCH (provider:LegalEntity)-[t:INTERCOMPANY_TRANSACTION]->(recipient:LegalEntity)
            RETURN {txn_id:t.txn_id, fiscal_year:t.fiscal_year, provider_entity:provider.entity_id,
                    recipient_entity:recipient.entity_id, transaction_type:t.transaction_type,
                    description:t.description, amount_local:t.amount_local, currency:t.currency,
                    amount_usd:t.amount_usd, pricing_policy:t.pricing_policy,
                    written_agreement:CASE WHEN t.written_agreement THEN 'Y' ELSE 'N' END,
                    agreement_date:toString(t.agreement_date), first_year:t.first_year, notes:t.notes} AS transaction
            ORDER BY transaction.fiscal_year, transaction.txn_id
        """)
        rules = repo.query("MATCH (r:TPRule) RETURN r {.*} AS rule ORDER BY r.rule_id")
        comparable_rows = repo.query("""
            MATCH (c:Comparable)-[:HAS_FINANCIAL]->(f:ComparableFinancial)
            RETURN c.segment AS segment, c.comp_id AS comp_id, c.company_name AS company_name,
                   c.country AS country, c.business_description AS business_description,
                   c.largest_shareholder_pct AS largest_shareholder_pct, f.fiscal_year AS fiscal_year,
                   f.revenue_musd AS revenue_musd, f.operating_profit_musd AS operating_profit_musd,
                   f.total_costs_musd AS total_costs_musd
            ORDER BY segment, comp_id, fiscal_year
        """)
        comparable_sets = {"services": [], "distributor": []}
        for row in comparable_rows:
            comparable_sets[row.pop("segment")].append(row)
        tp_rules = [row["rule"] for row in rules]
        return {
            "entities": [row["entity"] for row in entities],
            "financials": [row["financial"] for row in financials],
            "ic_transactions": [row["transaction"] for row in transactions],
            "tp_rules": tp_rules,
            "rulesMeta": {rule["rule_id"]: rule for rule in tp_rules},
            "comparables_services": comparable_sets["services"],
            "comparables_distributors": comparable_sets["distributor"],
            "sampleTranscript": "",
        }
    finally:
        repo.close()

@app.get("/api/v1/triggers")
def triggers(repo: Neo4jRepository = Depends(repository)):
    try:
        return repo.query("""
            MATCH (provider:LegalEntity)-[t:INTERCOMPANY_TRANSACTION]->(recipient:LegalEntity)
            WHERE t.written_agreement = false
            RETURN 'high' AS severity, 'Missing intercompany agreement' AS trigger,
                   t.txn_id AS transaction_id, t.transaction_type AS transaction_type,
                   provider.entity_name AS provider, recipient.entity_name AS recipient,
                   'Draft agreement and delineate the transaction' AS recommended_action,
                   'OECD TP Guidelines Ch. I, Section D.1' AS citation
            ORDER BY t.fiscal_year DESC
        """)
    finally:
        repo.close()


@app.get("/api/v1/entities/{entity_id}")
def entity(entity_id: str, repo: Neo4jRepository = Depends(repository)):
    try:
        rows = repo.query("MATCH (e:LegalEntity {entity_id:$entity_id}) RETURN e {.*} AS entity", {"entity_id": entity_id})
        if not rows:
            raise HTTPException(404, "Entity not found")
        return rows[0]
    finally:
        repo.close()


@app.get("/api/v1/entities/{entity_id}/far")
def far_draft(entity_id: str, repo: Neo4jRepository = Depends(repository)):
    try:
        rows = repo.query("""
            MATCH (e:LegalEntity {entity_id:$entity_id})
            RETURN e.entity_id AS entity_id, e.entity_name AS entity_name,
                   split(e.key_functions, ';') AS proposed_functions,
                   split(e.key_assets, ';') AS proposed_assets,
                   split(e.key_risks, ';') AS proposed_risks,
                   e.suggested_method AS proposed_method, e.suggested_pli AS proposed_pli,
                   'AI draft based on illustrative entity data; consultant approval required.' AS disclaimer
        """, {"entity_id": entity_id})
        if not rows:
            raise HTTPException(404, "Entity not found")
        return rows[0]
    finally:
        repo.close()


@app.post("/api/v1/entities/{entity_id}/far")
def approve_far(entity_id: str, update: FarUpdate, repo: Neo4jRepository = Depends(repository)):
    try:
        event_id = str(uuid4())
        repo.execute("""
            MATCH (e:LegalEntity {entity_id:$entity_id})
            MERGE (far:FARAssessment {entity_id:$entity_id})
            SET far.functions=$functions, far.assets=$assets, far.risks=$risks, far.notes=$notes,
                far.approved=true, far.reviewer=$reviewer, far.updated_at=$updated_at
            MERGE (e)-[:HAS_FAR]->(far)
            CREATE (audit:AuditEvent {id:$event_id, action:'FAR approved', actor:$reviewer, created_at:$updated_at})-[:RELATES_TO]->(far)
        """, {"entity_id": entity_id, **update.model_dump(), "event_id": event_id, "updated_at": datetime.now(timezone.utc).isoformat()})
        return {"entity_id": entity_id, "status": "approved", "audit_event_id": event_id}
    finally:
        repo.close()


@app.get("/api/v1/comparables/{segment}")
def comparables(segment: str, repo: Neo4jRepository = Depends(repository)):
    try:
        return repo.query("""
            MATCH (c:Comparable {segment:$segment})-[:HAS_FINANCIAL]->(f:ComparableFinancial)
            RETURN c.comp_id AS id, c.company_name AS company, c.country AS country, c.business_description AS description,
                   collect({year:f.fiscal_year, operating_margin:f.operating_profit_musd / f.revenue_musd, net_cost_plus:f.operating_profit_musd / f.total_costs_musd}) AS financials
            ORDER BY company
        """, {"segment": segment})
    finally:
        repo.close()


@app.post("/api/v1/benchmarks")
def benchmark(request: BenchmarkRequest, repo: Neo4jRepository = Depends(repository)):
    try:
        metric = "operating_profit_musd / revenue_musd" if request.segment == "distributor" else "operating_profit_musd / total_costs_musd"
        rows = repo.query(f"""
            MATCH (c:Comparable {{segment:$segment}})-[:HAS_FINANCIAL]->(f:ComparableFinancial)
            WITH c, avg({metric}) AS margin
            RETURN c.comp_id AS id, c.company_name AS company, margin
            ORDER BY company
        """, {"segment": request.segment})
        entity_rows = repo.query("""
            MATCH (e:LegalEntity {entity_id:$entity_id})-[:REPORTED_RESULT]->(f:FinancialResult)
            WITH e, f ORDER BY f.fiscal_year DESC LIMIT 1
            RETURN CASE WHEN $segment='distributor' THEN f.operating_profit / f.revenue ELSE f.operating_profit / f.total_costs END AS margin
        """, {"entity_id": request.tested_entity_id, "segment": request.segment})
        if not rows or not entity_rows:
            raise HTTPException(404, "Comparable set or tested entity result not found")
        baseline = request.tested_margin if request.tested_margin is not None else float(entity_rows[0]["margin"])
        result = calculate_range(rows, baseline + request.scenario_margin_delta)
        result.update({"segment": request.segment, "comparables": rows, "scenario_margin_delta": request.scenario_margin_delta})
        return result
    finally:
        repo.close()


@app.post("/api/v1/reports/draft")
def draft_report(request: ReportRequest, repo: Neo4jRepository = Depends(repository)):
    try:
        entity_row = repo.query("MATCH (e:LegalEntity {entity_id:$id}) RETURN e {.*} AS entity", {"id": request.entity_id})
        if not entity_row:
            raise HTTPException(404, "Entity not found")
        entity = entity_row[0]["entity"]
        report = f"""# Draft TNMM Benchmarking Section\n\n## Tested party\n{entity['entity_name']} ({entity['country']}) is proposed as the tested party because it is described as: {entity['functional_profile']}\n\n## Method and PLI\nProposed method: **{entity['suggested_method']}**. Proposed PLI: **{entity['suggested_pli']}**. This is an AI-assisted draft and requires consultant approval.\n\n## Regulatory support\nOECD Transfer Pricing Guidelines Chapters I and III support an arm's-length analysis and use of an arm's-length range. In the United States, the analogous profit-based method is commonly referred to as the Comparable Profits Method (CPM).\n\n## Comparable screening\nThe {request.benchmark_segment} comparable set is illustrative. Every accept/reject decision must be reviewed and recorded before relying on the conclusion.\n\n## Reviewer\nPrepared for review by {request.reviewer}.\n"""
        return {"entity_id": request.entity_id, "markdown": report, "disclaimer": "Illustrative hackathon output; not tax or legal advice."}
    finally:
        repo.close()