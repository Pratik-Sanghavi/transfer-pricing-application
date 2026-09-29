// Usage: NEO4J_URI=bolt://localhost:7687 NEO4J_PASSWORD=... node packages/graph/src/seed-cli.js [dataDir] [--reset]
import path from "path";
import { fileURLToPath } from "url";
import { loadCsvDir } from "./csv.js";
import { graphEnabled, close } from "./client.js";
import { seedGraph, reseed, graphStats } from "./repo.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dir = path.resolve(args.find((a) => !a.startsWith("--")) || path.join(here, "../../../apps/web/data"));

if (!graphEnabled()) { console.error("Set NEO4J_URI (and NEO4J_USER / NEO4J_PASSWORD) first."); process.exit(1); }
try {
  const data = loadCsvDir(dir);
  if (args.includes("--reset")) await reseed(data); else await seedGraph(data);
  const s = await graphStats();
  console.log(`Seeded Neo4j from ${dir}: ${s.nodes} nodes, ${s.rels} relationships.`);
} catch (e) {
  console.error("Seed failed:", e.message); process.exitCode = 1;
} finally { await close(); }
