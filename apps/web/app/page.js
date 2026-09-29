import { backendGet } from "@/lib/backend";
import App from "@/components/App";

export const dynamic = "force-dynamic";

async function loadClientData() {
  return backendGet("/api/v1/client-data");
}

export default async function Page() {
  const [data, llm] = await Promise.all([
    loadClientData(),
    backendGet("/api/v1/ai/status"),
  ]);
  return <App data={data} llm={llm} />;
}