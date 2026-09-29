// Persists consultant work (FAR, screening, reports, audit trail) to Neo4j.
import * as g from "@tp/graph";
import { loadCsvData } from "@/lib/data";

export async function POST(req) {
  const b = await req.json();
  if (!g.graphEnabled()) return Response.json({ persisted: false, mode: "csv" });
  try {
    switch (b.op) {
      case "far_proposal": await g.saveFarProposal(b.eid, b.ai); break;
      case "far_approve": await g.approveFar(b.eid, b.approved); break;
      case "screening": await g.saveScreening(b.eid, b.rows); await g.recomputeTriggers(); break;
      case "report": await g.saveReport(b.eid, b.text, b.source); break;
      case "audit": await g.appendAudit(b.event); break;
      case "reset": await g.resetCase(); break;
      case "reseed": await g.reseed(loadCsvData()); break;
      default: return Response.json({ error: `unknown op ${b.op}` }, { status: 400 });
    }
    return Response.json({ persisted: true, mode: "neo4j", ...(await g.graphStats()) });
  } catch (e) {
    console.error(`[neo4j] ${b.op} failed:`, e.message);
    return Response.json({ persisted: false, error: e.message });
  }
}
