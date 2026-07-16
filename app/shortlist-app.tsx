"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

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
  saved?: boolean;
  status?: "new" | "saved" | "applied";
};

type ConnectionStatus = {
  supabase: boolean;
  jobs: boolean;
  openrouter: boolean;
  automation: boolean;
};

type Profile = {
  targetTitle: string;
  location: string;
  minSalary: string;
  workModes: string[];
  resumeText: string;
  resumeFileName: string;
  dailyTime: string;
};

const initialProfile: Profile = {
  targetTitle: "Software Engineer",
  location: "New York, NY",
  minSalary: "100000",
  workModes: ["Remote", "Hybrid"],
  resumeText: "",
  resumeFileName: "",
  dailyTime: "07:00",
};

function demoLetter(title: string, company: string) {
  return `DEMO COVER LETTER — not generated from your resume\n\nDear ${company},\n\nI am writing to express my interest in the ${title} position. This sample shows where a personalized letter will appear after OpenRouter and your resume are connected.\n\nIn the connected version, this section will cite only experience, skills, and results found in your resume, matched directly to the responsibilities in the job description. It will not invent qualifications or reuse this generic demo language.\n\nThank you for your consideration.\n\nSincerely,\n[Your name]`;
}

const sampleJobs: Job[] = [
  {
    id: "stripe-product-engineer",
    source: "LinkedIn",
    title: "Product Engineer, New Grad",
    company: "Stripe",
    location: "New York, NY",
    workMode: "Hybrid",
    salary: "$132k–$198k",
    posted: "Demo",
    match: 96,
    reasons: ["TypeScript", "Product thinking", "Early career"],
    description:
      "Build and ship polished product experiences across Stripe's platform. Partner with design and product, work across the stack, and turn ambiguous customer problems into reliable software.",
    applyUrl: "https://www.linkedin.com/jobs/",
    coverLetter: demoLetter("Product Engineer, New Grad", "Stripe"),
    isDemo: true,
  },
  {
    id: "notion-frontend-engineer",
    source: "Indeed",
    title: "Frontend Software Engineer",
    company: "Notion",
    location: "New York, NY",
    workMode: "Hybrid",
    salary: "$135k–$185k",
    posted: "Demo",
    match: 93,
    reasons: ["React", "Design systems", "Collaboration"],
    description:
      "Create fast, thoughtful interfaces used by teams around the world. Own features end to end, collaborate closely with designers, and strengthen the foundations of a growing web application.",
    applyUrl: "https://www.indeed.com/",
    coverLetter: demoLetter("Frontend Software Engineer", "Notion"),
    isDemo: true,
  },
  {
    id: "figma-software-engineer",
    source: "LinkedIn",
    title: "Software Engineer, Growth",
    company: "Figma",
    location: "United States",
    workMode: "Remote",
    salary: "$128k–$170k",
    posted: "Demo",
    match: 91,
    reasons: ["Full-stack", "Experimentation", "User focus"],
    description:
      "Develop product-led growth experiences, run thoughtful experiments, and work with a cross-functional team to help more people discover and succeed with collaborative design tools.",
    applyUrl: "https://www.linkedin.com/jobs/",
    coverLetter: demoLetter("Software Engineer, Growth", "Figma"),
    isDemo: true,
  },
  {
    id: "ramp-associate-engineer",
    source: "Indeed",
    title: "Associate Software Engineer",
    company: "Ramp",
    location: "New York, NY",
    workMode: "On-site",
    salary: "$110k–$145k",
    posted: "Demo",
    match: 88,
    reasons: ["Python", "APIs", "Fast-paced team"],
    description:
      "Help build financial tools that save businesses time. Work across APIs and user-facing workflows while learning from experienced engineers in a high-ownership environment.",
    applyUrl: "https://www.indeed.com/",
    coverLetter: demoLetter("Associate Software Engineer", "Ramp"),
    isDemo: true,
  },
  {
    id: "linear-web-engineer",
    source: "LinkedIn",
    title: "Web Engineer",
    company: "Linear",
    location: "United States",
    workMode: "Remote",
    salary: "$120k–$175k",
    posted: "Demo",
    match: 86,
    reasons: ["React", "Performance", "Craft"],
    description:
      "Build high-quality web experiences with a focus on speed, interaction detail, and maintainable systems. Shape product direction and raise the bar for interface craft.",
    applyUrl: "https://www.linkedin.com/jobs/",
    coverLetter: demoLetter("Web Engineer", "Linear"),
    isDemo: true,
  },
];

function formatSalary(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `$${Math.round(amount / 1000)}k+` : "Any salary";
}

export function ShortlistApp() {
  const [profile, setProfile] = useState(initialProfile);
  const [draftProfile, setDraftProfile] = useState(initialProfile);
  const [jobs, setJobs] = useState(sampleJobs);
  const [activeTab, setActiveTab] = useState<"today" | "saved" | "applied">("today");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [letter, setLetter] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [connections, setConnections] = useState<ConnectionStatus>({ supabase: false, jobs: false, openrouter: false, automation: false });
  const [notice, setNotice] = useState("");
  const [settingsError, setSettingsError] = useState("");

  useEffect(() => {
    fetch("/api/config-status")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data && setConnections(data))
      .catch(() => undefined);
    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.profile) return;
        const saved = { ...initialProfile, ...data.profile };
        setProfile(saved);
        setDraftProfile(saved);
      })
      .catch(() => undefined);
  }, []);

  const visibleJobs = useMemo(() => {
    if (activeTab === "saved") return jobs.filter((job) => job.saved || job.status === "saved");
    if (activeTab === "applied") return jobs.filter((job) => job.status === "applied");
    return jobs;
  }, [activeTab, jobs]);

  const resumePercent = profile.resumeText.trim().length > 120 ? 100 : profile.resumeText.trim() ? 55 : 0;

  async function findJobs() {
    setIsSearching(true);
    setNotice("");
    try {
      const response = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await response.json();
      if (Array.isArray(data.jobs) && data.jobs.length) setJobs(data.jobs);
      setNotice(data.mode === "live" ? "Jobs and cover letters refreshed." : "Demo data refreshed. No job API is connected.");
    } catch {
      setNotice("Refresh failed. The labeled demo data is still shown.");
    } finally {
      setIsSearching(false);
    }
  }

  function openSettings() {
    setDraftProfile(profile);
    setSettingsError("");
    setSettingsOpen(true);
  }

  async function saveProfile() {
    if (!draftProfile.targetTitle.trim()) {
      setSettingsError("Add at least one target job title.");
      return;
    }
    setProfile(draftProfile);
    setSettingsOpen(false);
    setNotice("Search profile saved.");
    fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftProfile),
    }).catch(() => undefined);
  }

  async function uploadResume(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name)) {
      setSettingsError("For this first version, upload a .txt or .md resume, or paste the text below.");
      return;
    }
    const resumeText = await file.text();
    setDraftProfile((current) => ({ ...current, resumeText, resumeFileName: file.name }));
    setSettingsError("");
  }

  async function toggleSaved(job: Job) {
    const saved = !job.saved;
    setJobs((current) => current.map((item) => (item.id === job.id ? { ...item, saved, status: saved ? "saved" : "new" } : item)));
    fetch("/api/jobs/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externalId: job.id, status: saved ? "saved" : "new" }),
    }).catch(() => undefined);
  }

  function viewLetter(job: Job) {
    setSelectedJob(job);
    setLetter(job.coverLetter);
  }

  async function markApplied() {
    if (!selectedJob) return;
    setJobs((current) => current.map((job) => (job.id === selectedJob.id ? { ...job, status: "applied" } : job)));
    await fetch("/api/jobs/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externalId: selectedJob.id, status: "applied" }),
    }).catch(() => undefined);
    setNotice(`${selectedJob.company} moved to Applied.`);
    setSelectedJob(null);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Shortlist home">shortlist<span>.</span></a>
        <nav className="tabs" aria-label="Job views">
          {(["today", "saved", "applied"] as const).map((tab) => (
            <button key={tab} className={activeTab === tab ? "tab active" : "tab"} onClick={() => setActiveTab(tab)}>
              {tab === "today" ? "Today" : tab[0].toUpperCase() + tab.slice(1)}
              {tab === "saved" && <span className="count">{jobs.filter((job) => job.saved).length}</span>}
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          {(!connections.supabase || !connections.jobs || !connections.openrouter) && <span className="demo-mode">Demo mode</span>}
          <button className="resume-chip" onClick={openSettings}>
            <span className="resume-dot" /> Resume · {resumePercent}%
          </button>
        </div>
      </header>

      <main id="top">
        <section className="intro">
          <div>
            <p className="eyebrow">Job review</p>
            <h1>{activeTab === "today" ? "Jobs to review" : activeTab === "saved" ? "Saved jobs" : "Applications"}</h1>
            <p className="intro-copy">Jobs matching your saved search. Each cover letter is prepared before the job appears here.</p>
          </div>
          <div className="sync-block">
            <span className="status-dot neutral" />
            <div><strong>{connections.jobs && connections.openrouter ? "Manual refresh" : "Demo mode"}</strong><span>No automated run is scheduled</span></div>
          </div>
        </section>

        <section className="workspace">
          <aside className="profile-card">
            <div className="section-heading"><span>Search settings</span><button onClick={openSettings}>Edit</button></div>
            <div className="profile-role">{profile.targetTitle}</div>
            <div className="profile-list">
              <div><span>Location</span><strong>{profile.location || "Anywhere"}</strong></div>
              <div><span>Work style</span><strong>{profile.workModes.join(" + ") || "Any"}</strong></div>
              <div><span>Minimum</span><strong>{formatSalary(profile.minSalary)}</strong></div>
              <div><span>Sources</span><strong><i className="source-mark linkedin">in</i><i className="source-mark indeed">i</i> LinkedIn + Indeed</strong></div>
            </div>
            <button className="primary-button full" onClick={findJobs} disabled={isSearching}>
              {isSearching ? "Fetching jobs and writing letters…" : "Refresh jobs"}
              <span aria-hidden="true">→</span>
            </button>
            <p className="tiny-note">Placeholder records are marked Demo. No applications are submitted automatically.</p>
          </aside>

          <div className="jobs-panel">
            <div className="jobs-heading">
              <div>
                <p className="eyebrow">{activeTab === "today" ? "Results" : activeTab}</p>
                <h2>{visibleJobs.length} {visibleJobs.length === 1 ? "role" : "roles"}</h2>
              </div>
              <div className="rank-note">Match estimate</div>
            </div>

            {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}

            <div className="job-list">
              {visibleJobs.map((job, index) => (
                <article className="job-card" key={job.id}>
                  <div className="company-tile" aria-hidden="true">{job.company.slice(0, 1)}</div>
                  <div className="job-body">
                    <div className="job-topline">
                      {job.isDemo && <span className="demo-label">Demo</span>}
                      <span className={`source-pill ${job.source.toLowerCase()}`}>{job.source === "LinkedIn" ? "in" : "i"} {job.source}</span>
                      <span>{job.posted}</span>
                    </div>
                    <h3>{job.title}</h3>
                    <p className="company-line">{job.company} <span>·</span> {job.location}</p>
                    <div className="job-meta"><span>{job.workMode}</span><span>{job.salary}</span></div>
                    <div className="reason-row">{job.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
                  </div>
                  <div className="job-actions">
                    <div className="match-ring" style={{ "--match": `${job.match * 3.6}deg` } as React.CSSProperties}>
                      <div><strong>{job.match}%</strong><span>match</span></div>
                    </div>
                    <button className="letter-button" onClick={() => viewLetter(job)}>View cover letter <span>→</span></button>
                    <button className={job.saved ? "save-button saved" : "save-button"} onClick={() => toggleSaved(job)} aria-label={job.saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}>
                      {job.saved ? "Saved" : "Save"}
                    </button>
                  </div>
                  {index === 0 && !job.isDemo && <span className="best-fit">Best fit</span>}
                </article>
              ))}
              {!visibleJobs.length && (
                <div className="empty-state"><span>＋</span><h3>Nothing here yet</h3><p>Save a role or mark an application to build this list.</p><button onClick={() => setActiveTab("today")}>Back to today</button></div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer><span>shortlist.</span><p>Private job workspace</p><button onClick={openSettings}>Connections & settings</button></footer>

      {settingsOpen && (
        <div className="overlay" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setSettingsOpen(false)}>
          <section className="drawer settings-drawer" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="drawer-header"><div><p className="eyebrow">Settings</p><h2 id="settings-title">Search profile</h2></div><button className="close-button" onClick={() => setSettingsOpen(false)} aria-label="Close">×</button></div>
            <p className="drawer-intro">These fields control job search, matching, and the cover letters prepared during refresh.</p>

            <div className="connection-panel">
              <div className="connection-heading"><strong>Server connections</strong><span>Keys are never entered in this page</span></div>
              <div className="connection-list">
                <span>Supabase <i className={connections.supabase ? "connected" : "missing"}>{connections.supabase ? "Connected" : "Not connected"}</i></span>
                <span>Job API <i className={connections.jobs ? "connected" : "missing"}>{connections.jobs ? "Connected" : "Not connected"}</i></span>
                <span>OpenRouter <i className={connections.openrouter ? "connected" : "missing"}>{connections.openrouter ? "Connected" : "Not connected"}</i></span>
                <span>Daily automation <i className="missing">Not configured</i></span>
              </div>
              <small>Add these as server environment variables using the setup guide in the project.</small>
            </div>

            <label className="field"><span>General job title</span><input value={draftProfile.targetTitle} onChange={(event) => setDraftProfile({ ...draftProfile, targetTitle: event.target.value })} placeholder="e.g. Product Designer" /></label>
            <div className="field-grid">
              <label className="field"><span>Location</span><input value={draftProfile.location} onChange={(event) => setDraftProfile({ ...draftProfile, location: event.target.value })} placeholder="City or Anywhere" /></label>
              <label className="field"><span>Minimum salary</span><input type="number" value={draftProfile.minSalary} onChange={(event) => setDraftProfile({ ...draftProfile, minSalary: event.target.value })} placeholder="100000" /></label>
            </div>
            <fieldset className="field"><legend>Work style</legend><div className="choice-row">{["Remote", "Hybrid", "On-site"].map((mode) => <button type="button" key={mode} className={draftProfile.workModes.includes(mode) ? "choice active" : "choice"} onClick={() => setDraftProfile((current) => ({ ...current, workModes: current.workModes.includes(mode) ? current.workModes.filter((item) => item !== mode) : [...current.workModes, mode] }))}>{mode}</button>)}</div></fieldset>

            <div className="resume-section">
              <div className="resume-heading"><div><span>Resume</span><small>Used only to rank jobs and write your letters</small></div><label className="upload-button">Upload .txt<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={uploadResume} /></label></div>
              {draftProfile.resumeFileName && <div className="file-chip"><span>DOC</span><div><strong>{draftProfile.resumeFileName}</strong><small>Ready to use</small></div></div>}
              <textarea value={draftProfile.resumeText} onChange={(event) => setDraftProfile({ ...draftProfile, resumeText: event.target.value })} placeholder="Paste the text from your resume here…" rows={8} />
            </div>

            <div className="daily-row"><div><span className="status-dot neutral" /><strong>Preferred run time</strong><small>Saved only; automation is not connected</small></div><label><span>at</span><input type="time" value={draftProfile.dailyTime} onChange={(event) => setDraftProfile({ ...draftProfile, dailyTime: event.target.value })} /></label></div>
            {settingsError && <p className="form-error">{settingsError}</p>}
            <div className="drawer-footer"><button className="secondary-button" onClick={() => setSettingsOpen(false)}>Cancel</button><button className="primary-button" onClick={saveProfile}>Save profile <span>→</span></button></div>
          </section>
        </div>
      )}

      {selectedJob && (
        <div className="overlay" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setSelectedJob(null)}>
          <section className="drawer letter-drawer" role="dialog" aria-modal="true" aria-labelledby="letter-title">
            <div className="drawer-header"><div><p className="eyebrow">Cover letter</p><h2 id="letter-title">{selectedJob.title}</h2><span>{selectedJob.company} · {selectedJob.location}</span></div><button className="close-button" onClick={() => setSelectedJob(null)} aria-label="Close">×</button></div>
            <div className="letter-context">{selectedJob.isDemo && <span className="demo-label">Demo</span>}<span className={`source-pill ${selectedJob.source.toLowerCase()}`}>{selectedJob.source}</span><span>{selectedJob.match}% match estimate</span><span>{selectedJob.isDemo ? "Sample letter" : "OpenRouter"}</span></div>
            {selectedJob.isDemo && <div className="demo-warning">Demo letter. It is not based on your resume and is not ready to send.</div>}
            <textarea className="letter-paper" value={letter} onChange={(event) => setLetter(event.target.value)} aria-label="Prepared cover letter" />
            <p className="letter-note">Review and edit every letter before sending it.</p>
            <div className="letter-actions"><button className="secondary-button" onClick={() => navigator.clipboard.writeText(letter)}>Copy letter</button><a className="secondary-button" href={selectedJob.applyUrl} target="_blank" rel="noreferrer">Open job ↗</a><button className="primary-button" onClick={markApplied}>Mark applied <span>✓</span></button></div>
          </section>
        </div>
      )}
    </div>
  );
}
