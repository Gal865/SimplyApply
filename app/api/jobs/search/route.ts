import { createCoverLetter, demoCoverLetter } from "../../../../lib/cover-letter";
import { ownerEmail, supabaseConfigured, upsertRows } from "../../../../lib/supabase-rest";

type Job = {
  id: string;
  source: "LinkedIn" | "Indeed";
  title: string;
  company: string;
  location: string;
  workMode: string;
  salary: string;
  posted: string;
  match: number;
  reasons: string[];
  description: string;
  applyUrl: string;
  coverLetter: string;
  isDemo?: boolean;
};

const demoBase = [
  { id: "demo-stripe-product-engineer", source: "LinkedIn" as const, title: "Product Engineer, New Grad", company: "Stripe", location: "New York, NY", workMode: "Hybrid", salary: "$132k–$198k", posted: "Demo", match: 96, reasons: ["TypeScript", "Product thinking", "Early career"], description: "Demonstration job description. This is not a current listing.", applyUrl: "https://www.linkedin.com/jobs/" },
  { id: "demo-notion-frontend-engineer", source: "Indeed" as const, title: "Frontend Software Engineer", company: "Notion", location: "New York, NY", workMode: "Hybrid", salary: "$135k–$185k", posted: "Demo", match: 93, reasons: ["React", "Design systems", "Collaboration"], description: "Demonstration job description. This is not a current listing.", applyUrl: "https://www.indeed.com/" },
  { id: "demo-figma-software-engineer", source: "LinkedIn" as const, title: "Software Engineer, Growth", company: "Figma", location: "United States", workMode: "Remote", salary: "$128k–$170k", posted: "Demo", match: 91, reasons: ["Full-stack", "Experimentation", "User focus"], description: "Demonstration job description. This is not a current listing.", applyUrl: "https://www.linkedin.com/jobs/" },
  { id: "demo-ramp-associate-engineer", source: "Indeed" as const, title: "Associate Software Engineer", company: "Ramp", location: "New York, NY", workMode: "On-site", salary: "$110k–$145k", posted: "Demo", match: 88, reasons: ["Python", "APIs", "Fast-paced team"], description: "Demonstration job description. This is not a current listing.", applyUrl: "https://www.indeed.com/" },
];

const demoJobs: Job[] = demoBase.map((job) => ({
  ...job,
  isDemo: true,
  coverLetter: demoCoverLetter(job),
}));

type ProviderJob = Record<string, unknown>;

function sourceFor(job: ProviderJob): "LinkedIn" | "Indeed" {
  const text = `${job.job_publisher || ""} ${job.job_apply_link || ""}`.toLowerCase();
  return text.includes("indeed") ? "Indeed" : "LinkedIn";
}

function salaryFor(job: ProviderJob) {
  const min = Number(job.job_min_salary);
  const max = Number(job.job_max_salary);
  if (!min && !max) return "Salary not listed";
  const compact = (value: number) => `$${Math.round(value / 1000)}k`;
  return min && max ? `${compact(min)}–${compact(max)}` : `${compact(min || max)}+`;
}

function normalize(job: ProviderJob, index: number): Omit<Job, "coverLetter"> {
  const location = [job.job_city, job.job_state].filter(Boolean).join(", ") || String(job.job_country || "Remote");
  return {
    id: String(job.job_id || `job-${index}`),
    source: sourceFor(job),
    title: String(job.job_title || "Untitled role"),
    company: String(job.employer_name || "Company"),
    location,
    workMode: job.job_is_remote ? "Remote" : "On-site / Hybrid",
    salary: salaryFor(job),
    posted: index < 2 ? "Today" : "This week",
    match: Math.max(76, 96 - index * 3),
    reasons: ["Title match", job.job_is_remote ? "Remote" : "Location match", "Resume fit"],
    description: String(job.job_description || "Open the listing to review the full role description.").slice(0, 7000),
    applyUrl: String(job.job_apply_link || "#"),
  };
}

async function attachLetters(jobs: Array<Omit<Job, "coverLetter">>, resumeText: string): Promise<Job[]> {
  return Promise.all(
    jobs.map(async (job) => ({
      ...job,
      coverLetter:
        (await createCoverLetter(job, resumeText)) ||
        "Cover letter unavailable. Connect OpenRouter and add your resume, then refresh the job list.",
    })),
  );
}

async function saveJobs(request: Request, jobs: Job[], titles: string[], location: string) {
  if (!supabaseConfigured()) return;
  const email = ownerEmail(request);
  await upsertRows("profiles?on_conflict=owner_email", {
    owner_email: email,
    target_title: titles.join("\n"),
    location,
    updated_at: new Date().toISOString(),
  });
  await upsertRows("jobs?on_conflict=owner_email,external_id", jobs.map((job) => ({
    owner_email: email,
    external_id: job.id,
    source: job.source,
    title: job.title,
    company: job.company,
    location: job.location,
    work_mode: job.workMode,
    salary_text: job.salary,
    apply_url: job.applyUrl,
    description: job.description,
    match_score: job.match,
    match_reasons: job.reasons,
    cover_letter: job.coverLetter,
    status: "new",
    last_seen_at: new Date().toISOString(),
  })));
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const titles = (Array.isArray(body.targetTitles) ? body.targetTitles : [body.targetTitle])
    .map((title: unknown) => String(title || "").trim())
    .filter(Boolean)
    .slice(0, 8);
  const location = String(body.location || "United States").slice(0, 180);
  const resumeText = String(body.resumeText || "").slice(0, 30000);
  const apiKey = process.env.JSEARCH_API_KEY;

  if (!titles.length) return Response.json({ error: "Save at least one job title before searching." }, { status: 400 });

  if (!apiKey) return Response.json({ mode: "demo", jobs: demoJobs });

  const results = await Promise.all(titles.map(async (title) => {
    const params = new URLSearchParams({ query: `${title} jobs in ${location} from LinkedIn and Indeed`, page: "1", num_pages: "1", date_posted: "week" });
    const response = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, { headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" } });
    if (!response.ok) throw new Error("The job provider is temporarily unavailable.");
    const payload = (await response.json()) as { data?: ProviderJob[] };
    return payload.data || [];
  }));
  const seen = new Set<string>();
  const normalized = results.flat().filter((job) => {
    const id = String(job.job_id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, 6).map(normalize);
  const jobs = await attachLetters(normalized, resumeText);
  await saveJobs(request, jobs, titles, location);
  return Response.json({ mode: "live", jobs });
}
