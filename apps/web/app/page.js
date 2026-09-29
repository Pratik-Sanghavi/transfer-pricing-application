import { loadClientData } from "@/lib/data";
import { liveEnabled, MODEL_FAST, MODEL_STRONG } from "@/lib/llm";
import App from "@/components/App";

export const dynamic = "force-dynamic";

export default function Page() {
  const data = loadClientData();
  const llm = { live: liveEnabled(), fast: MODEL_FAST, strong: MODEL_STRONG };
  return <App data={data} llm={llm} />;
}
