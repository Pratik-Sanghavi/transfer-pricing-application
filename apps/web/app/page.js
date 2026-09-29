import { liveEnabled, MODEL_FAST, MODEL_STRONG } from "@/lib/llm";
import App from "@/components/App";

export const dynamic = "force-dynamic";

const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

async function loadClientData() {
  const response = await fetch(`${backendUrl}/api/v1/client-data`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Backend dataset request failed: ${response.status}`);
  return response.json();
}

export default async function Page() {
  const data = await loadClientData();
  const llm = { live: liveEnabled(), fast: MODEL_FAST, strong: MODEL_STRONG };
  return <App data={data} llm={llm} />;
}