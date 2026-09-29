const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

export async function backendGet(path) {
  const response = await fetch(`${backendUrl}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Backend request failed: ${response.status}`);
  return response.json();
}

export async function backendPost(path, body) {
  const response = await fetch(`${backendUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return Response.json(await response.json(), { status: response.status });
}