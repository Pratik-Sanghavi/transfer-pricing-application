import { extractFar } from "@/lib/llm";
export async function POST(req) {
  const { transcript, entity } = await req.json();
  return Response.json(await extractFar(transcript, entity));
}
