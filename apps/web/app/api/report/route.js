import { draftReport, mockFar } from "@/lib/llm";
export async function POST(req) {
  const { ctx } = await req.json();
  ctx.far ||= mockFar(ctx.entity);
  return Response.json(await draftReport(ctx));
}
