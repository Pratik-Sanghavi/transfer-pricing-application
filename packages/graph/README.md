# @tp/graph

Neo4j persistence for TP Copilot: driver (`client.js`), CSV extract loader (`csv.js`), and the repository (`repo.js`) with the schema, seeding, reads, case-state writes and trigger sync. The graph model is documented at the top of `repo.js` and in the root README.

```bash
NEO4J_URI=bolt://localhost:7687 NEO4J_PASSWORD=tpcopilot-dev npm run seed          # idempotent MERGE seed
NEO4J_URI=bolt://localhost:7687 NEO4J_PASSWORD=tpcopilot-dev npm run seed:reset    # wipe + reseed
```

Driver settings: lossless integers disabled (plain JS numbers), 5 s connection timeout and retry budget so the app falls back to CSV quickly if the graph is down.
