import type { AnalyzeResponse } from "./types";

const DEFAULT_ANALYZE_ENDPOINT = "https://example.com/analyze";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PING_BACKGROUND") {
    console.debug("[CV Tailor][bg] PING received");
    sendResponse({ type: "PONG_FROM_BACKGROUND" });
    return false;
  }

  if (message.type === "ANALYZE_JOB") {
    console.debug("[CV Tailor][bg] ANALYZE_JOB payload", message.payload);
    handleAnalyzeJob(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error: Error) =>
        sendResponse({ ok: false, error: error?.message || String(error) })
      );
    return true;
  }

  return false;
});

async function handleAnalyzeJob(payload: any): Promise<AnalyzeResponse> {
  const { jobDescription } = payload || {};
  if (!jobDescription || !jobDescription.text) {
    throw new Error("Missing job description text");
  }

  const { cvText, mockMode, analyzeEndpoint } = await storageGet([
    "cvText",
    "mockMode",
    "analyzeEndpoint",
  ]);
  console.debug("[CV Tailor][bg] Settings", {
    hasCv: !!cvText,
    mockMode,
    analyzeEndpoint,
  });

  if (!cvText || !cvText.trim()) {
    throw new Error("No CV stored. Add one in Options.");
  }

  if (mockMode) {
    console.debug("[CV Tailor][bg] Using mock analysis");
    return runMockAnalysis({ jobDescription, cvText });
  }

  const endpoint = analyzeEndpoint || DEFAULT_ANALYZE_ENDPOINT;
  console.debug("[CV Tailor][bg] Fetching analyze endpoint", endpoint);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_description: jobDescription,
        cv_text: cvText,
        target_role: jobDescription.title || "",
      }),
    });
  } catch (err: any) {
    console.error("[CV Tailor][bg] Network error", err);
    throw new Error("Network error: " + (err?.message || String(err)));
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Analyze failed (${response.status}): ${text || "unknown"}`);
  }

  const data = (await response.json()) as AnalyzeResponse;
  return data;
}

function runMockAnalysis({
  jobDescription,
  cvText,
}: {
  jobDescription: { text: string; title?: string };
  cvText: string;
}): AnalyzeResponse {
  const words = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4);

  const jdWords = words(jobDescription.text || "");
  const cvWords = new Set(words(cvText || ""));
  const jdFreq = jdWords.reduce<Record<string, number>>((acc, w) => {
    acc[w] = (acc[w] || 0) + 1;
    return acc;
  }, {});

  const keywords = Object.entries(jdFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);

  const gaps = keywords.filter((w) => !cvWords.has(w)).slice(0, 5);
  const strengths = keywords.filter((w) => cvWords.has(w)).slice(0, 5);
  const score = Math.max(
    35,
    Math.min(95, Math.round((strengths.length / (gaps.length + 1)) * 20 + 60))
  );

  return {
    score,
    summary:
      "Mock analysis: overlap-based estimate. Add missing keywords to improve match.",
    strengths,
    gaps,
    keyword_suggestions: gaps.map((g) => `Consider adding: ${g}`),
    tailored_bullets: gaps.map(
      (g) => `Show impact with ${g}: Delivered X using ${g}, resulting in Y.`
    ),
  };
}

function storageGet(keys: string[]): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        console.error("[CV Tailor][bg] storage.get error", chrome.runtime.lastError);
      }
      resolve(result || {});
    });
  });
}
