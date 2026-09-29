import { screenComps } from "@/lib/llm";
export async function POST(req) {
  const { comps, tested, far } = await req.json();
  return Response.json(await screenComps(comps, tested, far));
}
