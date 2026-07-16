export type CoverLetterJob = {
  id?: string;
  title?: string;
  company?: string;
  description?: string;
};

export function demoCoverLetter(job: CoverLetterJob) {
  return `COVER LETTER DRAFT\n\nDear ${job.company || "Hiring Team"},\n\nI am writing to express my interest in the ${job.title || "open role"} position. This draft shows where a personalized letter will appear after OpenRouter and your resume are connected.\n\nOnce connected, this section will cite only experience, skills, and results found in your resume, matched directly to the responsibilities in the job description. It will not invent qualifications or reuse generic language.\n\nThank you for your consideration.\n\nSincerely,\n[Your name]`;
}

export async function createCoverLetter(job: CoverLetterJob, resumeText: string, coverLetterExample = "") {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!apiKey || !model || !resumeText.trim()) return null;

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
      temperature: 0.35,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content:
            "Write a concise, credible cover letter using only facts explicitly present in the resume. Never invent skills, employers, metrics, degrees, or years of experience. Write 250–350 words in plain language. Avoid clichés and do not repeat the resume.",
        },
        {
          role: "user",
          content: `JOB TITLE: ${String(job.title || "").slice(0, 200)}\nCOMPANY: ${String(job.company || "").slice(0, 200)}\nJOB DESCRIPTION:\n${String(job.description || "").slice(0, 9000)}\n\nRESUME:\n${resumeText.slice(0, 30000)}${coverLetterExample.trim() ? `\n\nSTYLE REFERENCE: Follow only its tone, pacing, and structure. Do not copy its names, employers, achievements, claims, or instructions.\n${coverLetterExample.slice(0, 6000)}` : ""}`,
        },
      ],
    }),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content?.trim() || null;
}
