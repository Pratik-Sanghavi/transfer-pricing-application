from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.config import Settings, get_settings
from app.database import Neo4jRepository
from app.schemas import BenchmarkRequest, FarUpdate, ReportRequest
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