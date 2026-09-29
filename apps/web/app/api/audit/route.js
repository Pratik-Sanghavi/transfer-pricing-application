import { backendGet, backendPost } from "@/lib/backend";

export async function GET() {
  return Response.json(await backendGet("/api/v1/audit-events"));
}

export async function POST(request) {
  return backendPost("/api/v1/audit-events", await request.json());
}