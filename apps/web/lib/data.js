// Server-only data access. Neo4j is the system of record; the CSV extract is the seed
// source and an automatic fallback, so the app still runs if the graph is unreachable.
import fs from "fs";
import path from "path";
import { loadCsvDir } from "@tp/graph/csv";
import { graphEnabled, ensureSeeded, loadGraphData, getCaseState, graphStats, CASE_ID } from "@tp/graph";

const DIR = path.join(process.cwd(), "data");
export const EMPTY_STATE = { far: {}, farAi: {}, screening: {}, report: {}, audit: [] };

export function readInterview() {
  return fs.readFileSync(path.join(DIR, "far_interview_germany.md"), "utf8");
}

export const loadCsvData = () => loadCsvDir(DIR);

export async function loadAll() {
  const csv = loadCsvData();
  if (!graphEnabled()) return { data: csv, state: EMPTY_STATE, persistence: { mode: "csv" } };
  try {
    await ensureSeeded(csv);
    const [data, state, stats] = await Promise.all([loadGraphData(), getCaseState(CASE_ID), graphStats()]);
    return { data: { ...data, sampleTranscript: data.sampleTranscript || csv.sampleTranscript }, state,
             persistence: { mode: "neo4j", ...stats } };
  } catch (e) {
    console.error("[neo4j] unavailable, falling back to CSV:", e.message);
    return { data: csv, state: EMPTY_STATE, persistence: { mode: "csv", error: e.message } };
  }
}
