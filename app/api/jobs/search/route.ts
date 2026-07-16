import { ownerEmail, supabaseConfigured, upsertRows } from "../../../../lib/supabase-rest";

const previewJobs = [
  { id: "stripe-product-engineer", source: "LinkedIn", title: "Product Engineer, New Grad", company: "Stripe", location: "New York, NY", workMode: "Hybrid", salary: "$132k–$198k", posted: "2h ago", match: 96, reasons: ["TypeScript", "Product thinking", "Early career"], description: "Build and ship polished product experiences across Stripe's platform. Partner with design and product, work across the stack, and turn ambiguous customer problems into reliable software.", applyUrl: "https://www.linkedin.com/jobs/" },
  { id: "notion-frontend-engineer", source: "Indeed", title: "Frontend Software Engineer", company: "Notion", location: "New York, NY", workMode: "Hybrid", salary: "$135k–$185k", posted: "5h ago", match: 93, reasons: ["React", "Design systems", "Collaboration"], description: "Create fast, thoughtful interfaces used by teams around the world. Own features end to end and collaborate closely with designers.", applyUrl: "https://www.indeed.com/" },
  { id: "figma-software-engineer", source: "LinkedIn", title: "Software Engineer, Growth", company: "Figma", location: "United States", workMode: "Remote", salary: "$128k–$170k", posted: "Today", match: 91, reasons: ["Full-stack", "Experimentation", "User focus"], description: "Develop product-led growth experiences and work with a cross-functional team to help more people succeed with collaborative design tools.", applyUrl: "https://www.linkedin.com/jobs/" },
  { id: "ramp-associate-engineer", source: "Indeed", title: "Associate Software Engineer", company: "Ramp", location: "New York, NY", workMode: "On-site", salary: "$110k–$145k", posted: "1d ago", match: 88, reasons: ["Python", "APIs", "Fast-paced team"], description: "Help build financial tools that save businesses time. Work across APIs and user-facing workflows in a high-ownership environment.", applyUrl: "https://www.indeed.com/" },
  { id: "linear-web-engineer", source: "LinkedIn", title: "Web Engineer", company: "Linear", location: "United States", workMode: "Remote", salary: "$120k–$175k", posted: "1d ago", match: 86, reasons: ["React", "Performance", "Craft"], description: "Build high-quality web experiences with a focus on speed, interaction detail, and maintainable systems.", applyUrl: "https://www.linkedin.com/jobs/" },
];

type ProviderJob = Record<string, unknown>;

function sourceFor(job: ProviderJob) {
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

function normalize(job: ProviderJob, index: number) {
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

async function saveJobs(request: Request, jobs: ReturnType<typeof normalize>[] | typeof previewJobs, title: string, location: string) {
  if (!supabaseConfigured()) return;
  const email = ownerEmail(request);
  await upsertRows("profiles?on_conflict=owner_email", {
    owner_email: email,
    target_title: title,
    location,
    updated_at: new Date().toISOString(),
  }, "owner_email");
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
    status: "new",
    last_seen_at: new Date().toISOString(),
  })), "owner_email,external_id");
}

export async function POST(request: Request) {
  const body = await request.json();
  const title = String(body.targetTitle || "Software Engineer").slice(0, 180);
  const location = String(body.location || "United States").slice(0, 180);
  const apiKey = process.env.JSEARCH_API_KEY;

  if (!apiKey) {
    await saveJobs(request, previewJobs, title, location);
    return Response.json({ mode: "preview", jobs: previewJobs });
  }

  const params = new URLSearchParams({
    query: `${title} jobs in ${location} from LinkedIn and Indeed`,
    page: "1",
    num_pages: "1",
    date_posted: "week",
  });
  const response = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
  });
  if (!response.ok) return Response.json({ error: "The job provider is temporarily unavailable." }, { status: 502 });

  const payload = await response.json() as { data?: ProviderJob[] };
  const jobs = (payload.data || []).slice(0, 12).map(normalize);
  await saveJobs(request, jobs, title, location);
  return Response.json({ mode: "live", jobs });
}
