import { createHash } from "node:crypto";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { ownerEmail, supabaseConfigured, supabaseStorageRequest } from "../../../lib/supabase-rest";

export const runtime = "nodejs";

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const MAX_RESUME_TEXT = 30_000;
const RESUME_BUCKET = "resumes";

type ResumeFormat = {
  extension: "pdf" | "docx" | "txt" | "md";
  contentType: string;
};

function getResumeFormat(file: File): ResumeFormat | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return { extension, contentType: "application/pdf" };
  if (extension === "docx") return { extension, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  if (extension === "txt") return { extension, contentType: "text/plain" };
  if (extension === "md") return { extension, contentType: "text/markdown" };
  return null;
}

async function extractResumeText(bytes: Buffer, format: ResumeFormat) {
  if (format.extension === "pdf") {
    const parser = new PDFParse({ data: bytes });
    try {
      return (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  }

  if (format.extension === "docx") {
    return (await mammoth.extractRawText({ buffer: bytes })).value;
  }

  return bytes.toString("utf8");
}

async function ensureResumeBucket() {
  try {
    await supabaseStorageRequest("bucket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: RESUME_BUCKET,
        name: RESUME_BUCKET,
        public: false,
        file_size_limit: MAX_RESUME_BYTES,
        allowed_mime_types: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
          "text/markdown",
        ],
      }),
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.endsWith("409")) throw error;
  }
}

export async function POST(request: Request) {
  if (!supabaseConfigured()) {
    return Response.json({ error: "Connect Supabase before uploading a resume." }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get("resume");
  if (!(file instanceof File)) return Response.json({ error: "Choose a resume file to upload." }, { status: 400 });
  if (!file.size || file.size > MAX_RESUME_BYTES) {
    return Response.json({ error: "Resume files must be smaller than 10 MB." }, { status: 400 });
  }

  const format = getResumeFormat(file);
  if (!format) return Response.json({ error: "Upload a PDF, DOCX, TXT, or Markdown resume." }, { status: 400 });

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    let resumeText: string;
    try {
      resumeText = (await extractResumeText(bytes, format)).trim();
    } catch {
      return Response.json({ error: "We could not read that resume. Try a different PDF or DOCX file." }, { status: 400 });
    }
    if (!resumeText) {
      return Response.json({ error: "No readable text was found. Use a text-based PDF or DOCX file." }, { status: 400 });
    }

    const ownerHash = createHash("sha256").update(ownerEmail(request)).digest("hex");
    const objectPath = `${ownerHash}/resume.${format.extension}`;
    try {
      await ensureResumeBucket();
      await supabaseStorageRequest(`object/${RESUME_BUCKET}/${objectPath}`, {
        method: "PUT",
        headers: {
          "Content-Type": format.contentType,
          "x-upsert": "true",
        },
        body: bytes,
      });
    } catch {
      return Response.json({ error: "The resume could not be stored in Supabase. Check the server connection and try again." }, { status: 502 });
    }

    return Response.json({
      resumeText: resumeText.slice(0, MAX_RESUME_TEXT),
      resumeFileName: file.name.slice(0, 255),
    });
  } catch {
    return Response.json({ error: "The resume upload could not be completed." }, { status: 500 });
  }
}
