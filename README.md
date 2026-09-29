# Graph-Native Transfer Pricing Copilot

Monorepo for the TP Copilot hackathon build. Product requirements: [docs/PRD.md](docs/PRD.md).

```
apps/
  web/          Next.js UI + API routes (dashboard, FAR, benchmark, report, audit)
packages/       shared libraries (e.g. rule engine, Neo4j client) as they are split out
docs/           PRD and design notes
manifests/      Kubernetes (kustomize) deployment
```

## Quick start
```bash
npm install                              # installs all workspaces
cp apps/web/.env.example apps/web/.env.local   # optional: OPENROUTER_API_KEY
npm run dev                              # http://localhost:3000
```
Without an API key the app runs in demo mode with deterministic mock LLM output.

## Deploy
```bash
docker build -f apps/web/Dockerfile -t <registry>/tp-web:latest .   # from repo root
docker push <registry>/tp-web:latest
kubectl create secret generic tp-copilot-secrets --from-literal=OPENROUTER_API_KEY=sk-or-...
kubectl apply -k manifests/
```

All thresholds, rules and company data are illustrative demo data.
