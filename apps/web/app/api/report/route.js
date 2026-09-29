import { backendPost } from "@/lib/backend";

export async function POST(request) {
  return backendPost("/api/v1/ai/report", await request.json());
}