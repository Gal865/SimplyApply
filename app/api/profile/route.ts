import { ownerEmail, supabaseConfigured, supabaseRequest, upsertRows } from "../../../lib/supabase-rest";

export async function GET(request: Request) {
  if (!supabaseConfigured()) return Response.json({ configured: false, profile: null });
  const email = ownerEmail(request);
  const rows = await supabaseRequest<Array<Record<string, unknown>>>(
    `profiles?owner_email=eq.${encodeURIComponent(email)}&select=target_title,location,min_salary,work_modes,resume_text,resume_file_name,daily_digest_time&limit=1`,
  );
  const row = rows?.[0];
  if (!row) return Response.json({ configured: true, profile: null });
  return Response.json({
    configured: true,
    profile: {
      targetTitle: row.target_title,
      location: row.location,
      minSalary: row.min_salary ? String(row.min_salary) : "",
      workModes: row.work_modes,
      resumeText: row.resume_text,
      resumeFileName: row.resume_file_name,
      dailyTime: row.daily_digest_time,
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.targetTitle?.trim()) return Response.json({ error: "Target title is required." }, { status: 400 });
  if (!supabaseConfigured()) return Response.json({ configured: false, saved: false });

  await upsertRows("profiles?on_conflict=owner_email", {
    owner_email: ownerEmail(request),
    target_title: String(body.targetTitle).slice(0, 180),
    location: String(body.location || "").slice(0, 180),
    min_salary: Number(body.minSalary) || null,
    work_modes: Array.isArray(body.workModes) ? body.workModes.slice(0, 3) : [],
    resume_text: String(body.resumeText || "").slice(0, 30000),
    resume_file_name: String(body.resumeFileName || "").slice(0, 255),
    daily_digest_time: String(body.dailyTime || "07:00").slice(0, 5),
    updated_at: new Date().toISOString(),
  }, "owner_email");

  return Response.json({ configured: true, saved: true });
}
