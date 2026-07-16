import { ownerEmail, supabaseConfigured, supabaseRequest } from "../../../lib/supabase-rest";

function fallbackLetter(job: Record<string, string>) {
  return `Dear ${job.company || "Hiring Team"},\n\nI am excited to apply for the ${job.title || "open role"} position. My background has prepared me to contribute with a practical, user-focused approach while learning quickly and working closely with cross-functional partners.\n\nWhat stands out to me about this opportunity is the chance to bring strong execution and thoughtful problem-solving to work that matters. I would welcome the opportunity to connect my experience to your team's priorities and help deliver reliable, well-crafted results.\n\nThank you for considering my application. I would be glad to discuss how my background and working style can support ${job.company || "your team"}.\n\nSincerely,\n[Your name]`;
}

export async function POST(request: Request) {
  const body = await request.json();
  const job = body.job || {};
  const resumeText = String(body.resumeText || "").slice(0, 30000);
  if (!resumeText.trim()) return Response.json({ error: "Add a resume before generating a letter." }, { status: 400 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  let letter = fallbackLetter(job);
  let usedModel = "preview-template";

  if (apiKey && model) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.PUBLIC_SITE_URL || "https://shortlist.jobs",
        "X-Title": "Shortlist",
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        max_tokens: 700,
        messages: [
          { role: "system", content: "You write concise, credible cover letters. Use only facts explicitly present in the resume. Never invent skills, employers, metrics, degrees, or years of experience. Write 250–350 words in plain, confident language. Avoid clichés and do not repeat the resume." },
          { role: "user", content: `JOB TITLE: ${String(job.title || "").slice(0, 200)}\nCOMPANY: ${String(job.company || "").slice(0, 200)}\nJOB DESCRIPTION:\n${String(job.description || "").slice(0, 9000)}\n\nRESUME:\n${resumeText}` },
        ],
      }),
    });
    if (!response.ok) return Response.json({ error: "OpenRouter could not generate the letter." }, { status: 502 });
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    letter = payload.choices?.[0]?.message?.content?.trim() || letter;
    usedModel = model;
  }

  if (supabaseConfigured()) {
    await supabaseRequest("cover_letters", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        owner_email: ownerEmail(request),
        job_external_id: String(job.id || "unknown").slice(0, 255),
        company: String(job.company || "").slice(0, 255),
        job_title: String(job.title || "").slice(0, 255),
        content: letter,
        model: usedModel,
      }),
    });
  }

  return Response.json({ letter, mode: apiKey && model ? "live" : "preview", model: usedModel });
}
