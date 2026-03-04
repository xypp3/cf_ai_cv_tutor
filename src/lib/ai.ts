// Cloudflare Worker API client stubs and shared types.
// Replace fetch implementations with bundler-friendly calls when wiring build.

export type SuggestedEdit = {
  section: string;
  before: string;
  after: string;
  rationale: string;
};

export type AnalysisResult = {
  score: number; // 0-100
  summary: string;
  strengths: string[];
  gaps: string[];
  suggested_edits: SuggestedEdit[];
  tailored_bullets: string[];
};

export type AnalyzeRequest = {
  job_description: string;
  cv_text: string;
  target_role?: string;
};

export type CvPlain = {
  hash: string;
  sections: { heading: string; body: string }[];
  full_text: string;
  source: "manual_upload" | "google_drive";
  updated_at: string;
};

const defaultHeaders = (token?: string) =>
  ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  } satisfies Record<string, string>);

export async function fetchCvPlain(workerBase: string, token: string): Promise<CvPlain> {
  const res = await fetch(`${workerBase}/cv/plain`, {
    method: "GET",
    headers: defaultHeaders(token)
  });
  if (!res.ok) throw new Error(`cv/plain failed: ${res.status}`);
  return res.json() as Promise<CvPlain>;
}

export async function uploadCv(workerBase: string, token: string, file: File): Promise<CvPlain> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${workerBase}/cv/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form
  });
  if (!res.ok) throw new Error(`cv/upload failed: ${res.status}`);
  return res.json() as Promise<CvPlain>;
}

export async function analyze(workerBase: string, token: string, payload: AnalyzeRequest): Promise<AnalysisResult> {
  const res = await fetch(`${workerBase}/analyze`, {
    method: "POST",
    headers: defaultHeaders(token),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`analyze failed: ${res.status}`);
  return res.json() as Promise<AnalysisResult>;
}
