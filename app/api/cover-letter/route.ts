import { createCoverLetter, demoCoverLetter } from "../../../lib/cover-letter";
import { ownerEmail, supabaseConfigured, supabaseRequest } from "../../../lib/supabase-rest";

export async function POST(request: Request) {
  const body = await request.json();
  const job = body.job || {};
  const resumeText = String(body.resumeText || "").slice(0, 30000);
  const coverLetterExample = String(body.coverLetterExample || "").slice(0, 6000);
  if (!resumeText.trim()) return Response.json({ error: "Add a resume before generating a letter." }, { status: 400 });

  const generated = await createCoverLetter(job, resumeText, coverLetterExample);
  const letter = generated || demoCoverLetter(job);
  const model = generated ? process.env.OPENROUTER_MODEL || "openrouter" : "demo";

  if (generated && supabaseConfigured()) {
    await supabaseRequest("cover_letters", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        owner_email: ownerEmail(request),
        job_external_id: String(job.id || "unknown").slice(0, 255),
        company: String(job.company || "").slice(0, 255),
        job_title: String(job.title || "").slice(0, 255),
        content: letter,
        model,
      }),
    });
  }

  return Response.json({ letter, mode: generated ? "live" : "demo", model });
}
