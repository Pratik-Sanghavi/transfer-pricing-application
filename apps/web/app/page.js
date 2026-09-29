import { loadAll } from "@/lib/data";
import { liveEnabled, MODEL_FAST, MODEL_STRONG } from "@/lib/llm";
import App from "@/components/App";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { data, state, persistence } = await loadAll();
  const llm = { live: liveEnabled(), fast: MODEL_FAST, strong: MODEL_STRONG };
  return <App data={data} llm={llm} initialState={state} persistence={persistence} />;
}
