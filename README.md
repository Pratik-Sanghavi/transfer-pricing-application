# Graph-Native Transfer Pricing Copilot

Monorepo for the TP Copilot hackathon build. Product requirements: [docs/PRD.md](docs/PRD.md).

```
apps/
  web/          Next.js UI + API routes (dashboard, FAR, benchmark, report, audit)
packages/
  core/         rule engine + benchmark math (shared by the app and the graph layer)
  graph/        Neo4j persistence: driver, schema, seeding, case-state repository
docs/           PRD and design notes
manifests/      Kubernetes (kustomize) deployment
```

## Quick start
```bash
npm install                                    # installs all workspaces
docker compose up -d neo4j                     # Neo4j on :7687, Browser on http://localhost:7474
cp apps/web/.env.example apps/web/.env.local   # Neo4j creds preset; optional OPENROUTER_API_KEY
npm run dev                                    # http://localhost:3000 (auto-seeds an empty graph)
```
- **Neo4j is the system of record.** On first load an empty graph is seeded from the CSV extract in `apps/web/data`; after that every FAR draft/approval, comparable decision, report and audit event is written to the graph and survives restarts. Use **Reset demo case** in the sidebar to clear consultant work, or `npm run seed:reset` to rebuild the graph.
- **Fallbacks:** without `NEO4J_URI` (or if Neo4j is unreachable) the app reads the CSVs and keeps state in memory; without `OPENROUTER_API_KEY` it uses deterministic mock LLM output. The sidebar shows which mode is active.
- Neo4j Aura works too: set `NEO4J_URI=neo4j+s://<id>.databases.neo4j.io` and the password.

## Graph model
```
(:LegalEntity)-[:LOCATED_IN]->(:Jurisdiction)<-[:APPLIES_IN]-(:Rule)
(:LegalEntity)-[:PARENT_OF]->(:LegalEntity)            (:LegalEntity)-[:REPORTED]->(:Financials)
(:LegalEntity)-[:PROVIDES]->(:Transaction)-[:TO]->(:LegalEntity)
(:Transaction)-[:TRIGGERS]->(:Rule)                     (:LegalEntity|:Case)-[:FLAGGED_BY]->(:Rule)
(:Case)-[:USES_FAR]->(:FARAssessment)-[:ASSESSES]->(:LegalEntity)
(:Case)-[:SCREENED {tested_entity, accept, reason}]->(:Comparable)-[:HAS_FINANCIALS]->(:ComparableFinancials)
(:Case)-[:HAS_REPORT]->(:Report)                        (:AuditEvent)-[:RELATES_TO]->(:Case)
```

Queries worth showing in Neo4j Browser:
```cypher
// Which rules does each intercompany flow trigger?
MATCH p=(:LegalEntity)-[:PROVIDES]->(:Transaction)-[:TRIGGERS]->(:Rule) RETURN p;

// Everything flagged for Germany, with the jurisdiction behind each rule
MATCH p=(:LegalEntity {entity_id:'E05'})-[:FLAGGED_BY]->(:Rule)-[:APPLIES_IN]->(:Jurisdiction) RETURN p;

// Comparable decisions for the Germany benchmark, and why
MATCH (:Case)-[s:SCREENED {tested_entity:'E05'}]->(c:Comparable)
RETURN c.comp_id, c.company_name, s.accept, s.criterion, s.reason ORDER BY s.accept, c.comp_id;

// The audit trail
MATCH (a:AuditEvent)-[:RELATES_TO]->(:Case) RETURN a.time, a.step, a.entity, a.detail ORDER BY a.seq;
```

## Deploy
```bash
docker build -f apps/web/Dockerfile -t <registry>/tp-web:latest .   # from repo root
docker push <registry>/tp-web:latest
kubectl create secret generic neo4j-auth --from-literal=NEO4J_AUTH=neo4j/<password>
kubectl create secret generic tp-copilot-secrets --from-literal=NEO4J_PASSWORD=<password> --from-literal=OPENROUTER_API_KEY=sk-or-...
kubectl apply -k manifests/          # web app + Neo4j StatefulSet
```

Or everything locally with Docker: `docker compose up`.

All thresholds, rules and company data are illustrative demo data.
