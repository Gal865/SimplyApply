"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

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
  coverLetterState?: "processing" | "ready" | "failed";
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
  targetTitles: string[];
  location: string;
  workModes: string[];
  resumeText: string;
  resumeFileName: string;
  coverLetterExample: string;
  dailyTime: string;
};

const initialProfile: Profile = {
  targetTitles: [],
  location: "New York, NY",
  workModes: ["Remote", "Hybrid"],
  resumeText: "",
  resumeFileName: "",
  coverLetterExample: "",
  dailyTime: "07:00",
};

const MAX_RESUME_BYTES = 4 * 1024 * 1024;

async function readApiResponse(response: Response) {
  const text = await response.text();
  if (!text) return {} as { error?: string; saved?: boolean; jobs?: Job[]; mode?: string; letter?: string; resumeText?: string; resumeFileName?: string };
  try {
    return JSON.parse(text) as { error?: string; saved?: boolean; jobs?: Job[]; mode?: string; letter?: string; resumeText?: string; resumeFileName?: string };
  } catch {
    if (response.status === 413) return { error: "This resume is too large to upload. Choose a file smaller than 4 MB." };
    return { error: response.ok ? "The server returned an incomplete response. Please try saving again." : "The server could not complete that request." };
  }
}

export function ShortlistApp({ settingsMode = false }: { settingsMode?: boolean }) {
  const [profile, setProfile] = useState(initialProfile);
  const [draftProfile, setDraftProfile] = useState(initialProfile);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState<"today" | "saved" | "applied">("today");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [letterClosing, setLetterClosing] = useState(false);
  const [letter, setLetter] = useState("");
  const [connections, setConnections] = useState<ConnectionStatus>({ supabase: false, jobs: false, openrouter: false, automation: false });
  const [notice, setNotice] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [initialTitle, setInitialTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [initialTitleError, setInitialTitleError] = useState("");
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const coverLetterQueue = useRef(0);

  useEffect(() => {
    fetch("/api/config-status")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data && setConnections(data))
      .catch(() => undefined);
    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.profile) return;
        const localCoverLetterExample = localStorage.getItem("simply-apply-cover-letter-example") || "";
        const saved = { ...initialProfile, ...data.profile, coverLetterExample: data.profile.coverLetterExample || localCoverLetterExample };
        setProfile(saved);
        setDraftProfile(saved);
        setInitialTitle(saved.targetTitles[0] || "");
        const cachedJobs = sessionStorage.getItem("simply-apply-jobs");
        if (cachedJobs) {
          try {
            const savedJobs = JSON.parse(cachedJobs) as Job[];
            setJobs(savedJobs);
          } catch { sessionStorage.removeItem("simply-apply-jobs"); }
        }
      })
      .catch(() => undefined);
  }, []);

  const visibleJobs = useMemo(() => {
    if (activeTab === "saved") return jobs.filter((job) => job.saved || job.status === "saved");
    if (activeTab === "applied") return jobs.filter((job) => job.status === "applied");
    return jobs;
  }, [activeTab, jobs]);

  function storeJobs(nextJobs: Job[]) {
    sessionStorage.setItem("simply-apply-jobs", JSON.stringify(nextJobs));
    return nextJobs;
  }

  function updateJob(id: string, update: Partial<Job>) {
    setJobs((current) => storeJobs(current.map((job) => (job.id === id ? { ...job, ...update } : job))));
  }

  async function prepareCoverLetters(jobsToPrepare: Job[], searchProfile: Profile) {
    const queue = ++coverLetterQueue.current;
    for (const job of jobsToPrepare) {
      if (queue !== coverLetterQueue.current) return;
      try {
        const response = await fetch("/api/cover-letter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job, resumeText: searchProfile.resumeText, coverLetterExample: searchProfile.coverLetterExample }),
        });
        const data = await readApiResponse(response);
        if (!response.ok || typeof data.letter !== "string") throw new Error(data.error || "Cover letter could not be prepared.");
        if (queue === coverLetterQueue.current) updateJob(job.id, { coverLetter: data.letter, coverLetterState: "ready" });
      } catch {
        if (queue === coverLetterQueue.current) updateJob(job.id, { coverLetterState: "failed" });
      }
    }
  }

  function closeSettings() {
    if (settingsClosing) return;
    setSettingsClosing(true);
    window.setTimeout(() => {
      setSettingsOpen(false);
      setSettingsClosing(false);
    }, 220);
  }

  async function findJobs(searchProfile = profile) {
    if (!searchProfile.targetTitles.length) {
      setNotice("Save at least one job title before starting a search.");
      return;
    }
    setNotice("");
    try {
      const response = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchProfile),
      });
      const data = await readApiResponse(response);
      if (Array.isArray(data.jobs) && data.jobs.length) {
        const queuedJobs = data.jobs.map((job) => ({ ...job, coverLetter: "", coverLetterState: "processing" as const }));
        setJobs(storeJobs(queuedJobs));
        void prepareCoverLetters(queuedJobs, searchProfile);
      }
      setNotice("Jobs refreshed. Cover letters are being prepared one at a time.");
    } catch {
      setNotice("Refresh failed. Please try again shortly.");
    }
  }

  function closeLetter() {
    if (letterClosing) return;
    setLetterClosing(true);
    window.setTimeout(() => {
      setSelectedJob(null);
      setLetterClosing(false);
    }, 260);
  }

  async function saveInitialTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = initialTitle.trim();
    if (!title) {
      setInitialTitleError("Enter the exact job title you want to find.");
      return;
    }

    const savedProfile = { ...profile, targetTitles: [title] };
    setIsSavingTitle(true);
    setInitialTitleError("");
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savedProfile),
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || "The title could not be saved.");

      setProfile(savedProfile);
      setDraftProfile(savedProfile);
      setNotice(data.saved ? "Job title saved. No automated search has been started." : "Job title is ready for this preview. Connect Supabase to save it permanently.");
    } catch (error) {
      setInitialTitleError(error instanceof Error ? error.message : "The title could not be saved.");
    } finally {
      setIsSavingTitle(false);
    }
  }

  async function saveProfile() {
    const targetTitles = draftProfile.targetTitles.map((title) => title.trim()).filter(Boolean);
    if (!targetTitles.length) {
      setSettingsError("Add at least one target job title.");
      return;
    }
    const savedProfile = { ...draftProfile, targetTitles };
    setProfile(savedProfile);
    localStorage.setItem("simply-apply-cover-letter-example", savedProfile.coverLetterExample);
    setNotice("Search profile saved. Finding matching jobs and preparing cover letters…");
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(savedProfile),
    }).catch(() => undefined);
    void findJobs(savedProfile);
  }

  async function uploadResume(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_RESUME_BYTES) {
      setSettingsError("Resume files must be smaller than 4 MB.");
      event.target.value = "";
      return;
    }
    setIsUploadingResume(true);
    setSettingsError("");
    try {
      const formData = new FormData();
      formData.append("resume", file);
      const response = await fetch("/api/resume", { method: "POST", body: formData });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || "The resume could not be uploaded.");
      const resumeText = data.resumeText;
      const resumeFileName = data.resumeFileName;
      if (typeof resumeText !== "string" || typeof resumeFileName !== "string") throw new Error("The resume upload returned an incomplete response. Please try again.");
      setDraftProfile((current) => ({ ...current, resumeText, resumeFileName }));
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "The resume could not be uploaded.");
    } finally {
      setIsUploadingResume(false);
      event.target.value = "";
    }
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
    setLetterClosing(false);
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
    closeLetter();
  }

  if (settingsMode) {
    return (
      <div className="app-shell">
        <header className="topbar settings-topbar">
          <Link className="wordmark" href="/" aria-label="Simply Apply home">Simply <span>Apply</span></Link>
          <span className="settings-label">Settings</span>
          <Link className="resume-chip" href="/"><span aria-hidden="true">←</span> Back to jobs</Link>
        </header>
        <main className="settings-main">
          <section className="settings-page-heading">
            <p className="eyebrow">Your preferences</p>
            <h1>Search settings</h1>
            <p>Fine-tune what Simply Apply looks for and use to prepare your cover letters.</p>
          </section>
          <section className="settings-page-panel">
            <div className="drawer-header"><div><p className="eyebrow">Search profile</p><h2>What to look for</h2></div></div>
            <p className="drawer-intro">These fields control job search, matching, and the cover letters prepared during refresh.</p>

            <div className="connection-panel">
              <div className="connection-heading"><strong>Server connections</strong><span>Keys are never entered on this page</span></div>
              <div className="connection-list">
                <span>Supabase <i className={connections.supabase ? "connected" : "missing"}>{connections.supabase ? "Connected" : "Not connected"}</i></span>
                <span>Job API <i className={connections.jobs ? "connected" : "missing"}>{connections.jobs ? "Connected" : "Not connected"}</i></span>
                <span>OpenRouter <i className={connections.openrouter ? "connected" : "missing"}>{connections.openrouter ? "Connected" : "Not connected"}</i></span>
                <span>Daily automation <i className="missing">Not configured</i></span>
              </div>
              <small>Add these as server environment variables using the setup guide in the project.</small>
            </div>

            <label className="field"><span>Job titles</span><textarea className="job-titles-input" value={draftProfile.targetTitles.join("\n")} onChange={(event) => setDraftProfile({ ...draftProfile, targetTitles: event.target.value.split("\n") })} placeholder={"One exact title per line\ne.g. Product Designer\ne.g. UX Designer"} rows={4} /><small>JSearch runs a separate search for each title when you save.</small></label>
            <label className="field"><span>Location</span><input value={draftProfile.location} onChange={(event) => setDraftProfile({ ...draftProfile, location: event.target.value })} placeholder="City or Anywhere" /></label>
            <fieldset className="field"><legend>Work style</legend><div className="choice-row">{["Remote", "Hybrid", "On-site"].map((mode) => <button type="button" key={mode} className={draftProfile.workModes.includes(mode) ? "choice active" : "choice"} onClick={() => setDraftProfile((current) => ({ ...current, workModes: current.workModes.includes(mode) ? current.workModes.filter((item) => item !== mode) : [...current.workModes, mode] }))}>{mode}</button>)}</div></fieldset>

            <div className="resume-section">
              <div className="resume-heading"><div><span>Resume</span><small>Used only to rank jobs and write your letters</small></div></div>
              <label className="resume-upload-box">
                <input type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" onChange={uploadResume} disabled={isUploadingResume} />
                <span className="upload-icon" aria-hidden="true">↑</span>
                {isUploadingResume ? <><strong>Uploading your resume…</strong><small>Reading and storing it privately</small></> : draftProfile.resumeFileName ? <><strong>{draftProfile.resumeFileName}</strong><small>Uploaded privately · Choose a different file</small></> : <><strong>Upload your resume</strong><small>PDF, DOCX, TXT, or MD · up to 4 MB</small></>}
              </label>
            </div>

            <div className="cover-letter-style">
              <div className="cover-letter-style-heading"><span>Cover letter style</span><small>Optional writing reference</small></div>
              <label className="field"><span>Example cover letter</span><textarea className="cover-letter-example" value={draftProfile.coverLetterExample} onChange={(event) => setDraftProfile({ ...draftProfile, coverLetterExample: event.target.value.slice(0, 6000) })} placeholder="Paste a cover letter whose voice and structure you want to use." rows={9} /><small>Simply Apply will follow its tone and structure, but only use facts from your resume and the job description.</small></label>
            </div>

            <div className="daily-row"><div><span className="status-dot neutral" /><strong>Preferred run time</strong><small>Saved only; automation is not connected</small></div><label><span>at</span><input type="time" value={draftProfile.dailyTime} onChange={(event) => setDraftProfile({ ...draftProfile, dailyTime: event.target.value })} /></label></div>
            {settingsError && <p className="form-error">{settingsError}</p>}
            {notice && <div className="notice settings-notice" role="status">{notice}</div>}
            <div className="settings-page-actions"><Link className="secondary-button" href="/">Cancel</Link><button className="primary-button" onClick={saveProfile}>Save & search <span>→</span></button></div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Simply Apply home">Simply <span>Apply</span></a>
        <nav className="tabs" aria-label="Job views">
          {(["today", "saved", "applied"] as const).map((tab) => (
            <button key={tab} className={activeTab === tab ? "tab active" : "tab"} onClick={() => setActiveTab(tab)}>
              {tab === "today" ? "Today" : tab[0].toUpperCase() + tab.slice(1)}
              {tab === "saved" && <span className="count">{jobs.filter((job) => job.saved).length}</span>}
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          <Link className="resume-chip" href="/settings">
            Settings
          </Link>
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
            <div><strong>Manual refresh</strong><span>No automated run is scheduled</span></div>
          </div>
        </section>

        {!profile.targetTitles.length && (
          <section className="title-setup" aria-labelledby="title-setup-heading">
            <div>
              <p className="eyebrow">Start here</p>
              <h2 id="title-setup-heading">What job are you looking for?</h2>
              <p>Enter the actual title you want Simply Apply to search for. This saves your preference only—it does not run a search or schedule anything.</p>
            </div>
            <form onSubmit={saveInitialTitle}>
              <label htmlFor="initial-job-title">Job search title</label>
              <div className="title-entry-row">
                <input id="initial-job-title" value={initialTitle} onChange={(event) => { setInitialTitle(event.target.value); setInitialTitleError(""); }} placeholder="e.g. Junior Software Engineer" autoComplete="organization-title" autoFocus />
                <button className="primary-button" type="submit" disabled={isSavingTitle}>{isSavingTitle ? "Saving…" : "Save title"}<span aria-hidden="true">→</span></button>
              </div>
              {initialTitleError && <p className="form-error" role="alert">{initialTitleError}</p>}
              <small>You can add more titles and search details later in Search settings.</small>
            </form>
          </section>
        )}

        <section className="workspace">
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
                    <button className="letter-button" onClick={() => viewLetter(job)} disabled={job.coverLetterState !== "ready"}>{job.coverLetterState === "ready" ? <>View cover letter <span>→</span></> : "Processing cover letter…"}</button>
                    <button className={job.saved ? "save-button saved" : "save-button"} onClick={() => toggleSaved(job)} aria-label={job.saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}>
                      {job.saved ? "Saved" : "Save"}
                    </button>
                  </div>
                  {index === 0 && <span className="best-fit">Best fit</span>}
                </article>
              ))}
              {!visibleJobs.length && (
                <div className="empty-state"><span>＋</span><h3>{profile.targetTitles.length ? "Nothing here yet" : "Add your job titles"}</h3><p>{profile.targetTitles.length ? "Your saved titles did not return a matching role yet." : "Tell Simply Apply the exact roles you want, then save to begin the search and prepare cover letters."}</p>{profile.targetTitles.length ? <button onClick={() => setActiveTab("today")}>Back to today</button> : <Link href="/settings">Add job titles</Link>}</div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer><span>Simply Apply</span><p>Private job workspace</p><Link href="/settings">Settings</Link></footer>

      {settingsOpen && (
        <div className="dialog-root">
          <div className={settingsClosing ? "overlay is-closing" : "overlay"} role="presentation" onMouseDown={closeSettings} />
          <section className={settingsClosing ? "drawer settings-drawer is-closing" : "drawer settings-drawer"} role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="drawer-header"><div><p className="eyebrow">Settings</p><h2 id="settings-title">Search profile</h2></div><button className="close-button" onClick={closeSettings} aria-label="Close">×</button></div>
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

            <label className="field"><span>Job titles</span><textarea className="job-titles-input" value={draftProfile.targetTitles.join("\n")} onChange={(event) => setDraftProfile({ ...draftProfile, targetTitles: event.target.value.split("\n") })} placeholder={"One exact title per line\ne.g. Product Designer\ne.g. UX Designer"} rows={4} /><small>JSearch runs a separate search for each title when you save.</small></label>
            <label className="field"><span>Location</span><input value={draftProfile.location} onChange={(event) => setDraftProfile({ ...draftProfile, location: event.target.value })} placeholder="City or Anywhere" /></label>
            <fieldset className="field"><legend>Work style</legend><div className="choice-row">{["Remote", "Hybrid", "On-site"].map((mode) => <button type="button" key={mode} className={draftProfile.workModes.includes(mode) ? "choice active" : "choice"} onClick={() => setDraftProfile((current) => ({ ...current, workModes: current.workModes.includes(mode) ? current.workModes.filter((item) => item !== mode) : [...current.workModes, mode] }))}>{mode}</button>)}</div></fieldset>

            <div className="resume-section">
              <div className="resume-heading"><div><span>Resume</span><small>Used only to rank jobs and write your letters</small></div></div>
              <label className="resume-upload-box">
                <input type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" onChange={uploadResume} disabled={isUploadingResume} />
                <span className="upload-icon" aria-hidden="true">↑</span>
                {isUploadingResume ? <><strong>Uploading your resume…</strong><small>Reading and storing it privately</small></> : draftProfile.resumeFileName ? <><strong>{draftProfile.resumeFileName}</strong><small>Uploaded privately · Choose a different file</small></> : <><strong>Upload your resume</strong><small>PDF, DOCX, TXT, or MD · up to 10 MB</small></>}
              </label>
            </div>

            <div className="daily-row"><div><span className="status-dot neutral" /><strong>Preferred run time</strong><small>Saved only; automation is not connected</small></div><label><span>at</span><input type="time" value={draftProfile.dailyTime} onChange={(event) => setDraftProfile({ ...draftProfile, dailyTime: event.target.value })} /></label></div>
            {settingsError && <p className="form-error">{settingsError}</p>}
            <div className="drawer-footer"><button className="secondary-button" onClick={closeSettings}>Cancel</button><button className="primary-button" onClick={saveProfile}>Save & search <span>→</span></button></div>
          </section>
        </div>
      )}

      {selectedJob && (
        <div className="dialog-root">
          <div className={letterClosing ? "overlay is-closing" : "overlay"} role="presentation" onMouseDown={closeLetter} />
          <section className={letterClosing ? "drawer letter-drawer is-closing" : "drawer letter-drawer"} role="dialog" aria-modal="true" aria-labelledby="letter-title">
            <div className="drawer-header"><div><p className="eyebrow">Cover letter</p><h2 id="letter-title">{selectedJob.title}</h2><span>{selectedJob.company} · {selectedJob.location}</span></div><button className="close-button" onClick={closeLetter} aria-label="Close">×</button></div>
            <div className="letter-context"><span className={`source-pill ${selectedJob.source.toLowerCase()}`}>{selectedJob.source}</span><span>{selectedJob.match}% match estimate</span><span>Prepared letter</span></div>
            <textarea className="letter-paper" value={letter} onChange={(event) => setLetter(event.target.value)} aria-label="Prepared cover letter" />
            <p className="letter-note">Review and edit every letter before sending it.</p>
            <div className="letter-actions"><button className="secondary-button" onClick={() => navigator.clipboard.writeText(letter)}>Copy letter</button><a className="secondary-button" href={selectedJob.applyUrl} target="_blank" rel="noreferrer">Open job ↗</a><button className="primary-button" onClick={markApplied}>Mark applied <span>✓</span></button></div>
          </section>
        </div>
      )}
    </div>
  );
}
