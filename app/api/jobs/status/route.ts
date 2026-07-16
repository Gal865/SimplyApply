import { ownerEmail, supabaseConfigured, supabaseRequest } from "../../../../lib/supabase-rest";

export async function POST(request: Request) {
  const body = await request.json();
  const allowed = new Set(["new", "saved", "applied", "dismissed"]);
  if (!body.externalId || !allowed.has(body.status)) return Response.json({ error: "Invalid job status." }, { status: 400 });
  if (!supabaseConfigured()) return Response.json({ configured: false, saved: false });
  const filter = `jobs?owner_email=eq.${encodeURIComponent(ownerEmail(request))}&external_id=eq.${encodeURIComponent(String(body.externalId))}`;
  await supabaseRequest(filter, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: body.status, updated_at: new Date().toISOString() }),
  });
  return Response.json({ configured: true, saved: true });
}
