import neo4j from "neo4j-driver";

export const graphEnabled = () => Boolean(process.env.NEO4J_URI);

export function getDriver() {
  const g = globalThis;
  if (!g.__tpNeo4jDriver) {
    g.__tpNeo4jDriver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USER || "neo4j", process.env.NEO4J_PASSWORD || ""),
      { disableLosslessIntegers: true, connectionTimeout: 5000, maxTransactionRetryTime: 5000 },
    );
  }
  return g.__tpNeo4jDriver;
}

const cfg = () => (process.env.NEO4J_DATABASE ? { database: process.env.NEO4J_DATABASE } : {});

export async function run(cypher, params = {}) {
  const { records } = await getDriver().executeQuery(cypher, params, cfg());
  return records.map((r) => r.toObject());
}

export async function close() {
  if (globalThis.__tpNeo4jDriver) { await globalThis.__tpNeo4jDriver.close(); globalThis.__tpNeo4jDriver = null; }
}
