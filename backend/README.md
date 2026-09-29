# TP Copilot backend

FastAPI backend for the graph-native transfer-pricing copilot demo. It reads the seeded Neo4j graph and exposes endpoints for the group graph, compliance triggers, FAR review, comparable data, TNMM benchmark math, and a cited report draft.

## Run locally

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

For the local Kubernetes installation, port-forward Bolt before running the API:

```powershell
kubectl port-forward -n graphdb-ns-1 service/neo4j 7687:7687
```

Open `http://localhost:8000/docs` for interactive API documentation.

## Core endpoints

- `GET /health`
- `GET /api/v1/graph`
- `GET /api/v1/triggers`
- `GET /api/v1/entities/{entity_id}`
- `GET|POST /api/v1/entities/{entity_id}/far`
- `GET /api/v1/comparables/{segment}`
- `POST /api/v1/benchmarks`
- `POST /api/v1/reports/draft`

The default `.env.example` matches the local demo cluster, where Neo4j authentication is disabled. Enable auth and supply credentials before using any non-local deployment.