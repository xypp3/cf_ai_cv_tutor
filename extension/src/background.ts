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

  const { cvText, mockMode, analyzeEndpoint, cfAccountId, cfApiToken, cfModel } =
    await storageGet([
      "cvText",
      "mockMode",
      "analyzeEndpoint",
      "cfAccountId",
      "cfApiToken",
      "cfModel",
    ]);
  console.debug("[CV Tailor][bg] Settings", {
    hasCv: !!cvText,
    mockMode,
    analyzeEndpoint,
    cfAccountId: !!cfAccountId,
    cfModel,
  });

  if (!cvText || !cvText.trim()) {
    throw new Error("No CV stored. Add one in Options.");
  }

  if (mockMode) {
    console.debug("[CV Tailor][bg] Using mock analysis");
    return runMockAnalysis({ jobDescription, cvText });
  }

  if (analyzeEndpoint) {
    return callCustomAnalyzeEndpoint({ endpoint: analyzeEndpoint, jobDescription, cvText });
  }

  return callCloudflareAi({
    jobDescription,
    cvText,
    accountId: cfAccountId,
    apiToken: cfApiToken,
    model: cfModel || "@cf/meta/llama-3.2-3b-instruct",
  });
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

async function callCustomAnalyzeEndpoint({
  endpoint,
  jobDescription,
  cvText,
}: {
  endpoint: string;
  jobDescription: any;
  cvText: string;
}) {
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

async function callCloudflareAi({
  jobDescription,
  cvText,
  accountId,
  apiToken,
  model,
}: {
  jobDescription: any;
  cvText: string;
  accountId?: string;
  apiToken?: string;
  model: string;
}): Promise<AnalyzeResponse> {
  if (!accountId || !apiToken) {
    throw new Error("Cloudflare account ID and API token are required (set in Options).");
  }

  const normalizedModel = normalizeModel(model);
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${normalizedModel}`;
  const prompt = buildCfPrompt(jobDescription, cvText);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ ...prompt, stream: false }),
    });
  } catch (err: any) {
    console.error("[CV Tailor][bg] CF AI network error", err);
    throw new Error("Cloudflare AI network error: " + (err?.message || String(err)));
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[CV Tailor][bg] CF AI non-200", response.status, text);
    throw new Error(`Cloudflare AI failed (${response.status}): ${text || "unknown"}`);
  }

  const data = (await response.json()) as any;
  console.debug("[CV Tailor][bg] CF AI raw result", data);
  const text = extractCfText(data);
  const parsed = coerceAnalysisJson(text);
  return parsed;
}

function buildCfPrompt(job: any, cvText: string) {
  const jd = job?.text || "";
  const title = job?.title || "";
  const url = job?.url || "";
  const instructions = `
You are a senior HR executive evaluating how well a CV matches a job posting.
Compare the CV and job description and return ONLY valid JSON in this exact shape:
{
  "score": number (0-100),
  "summary": string,
  "strengths": string[],
  "gaps": string[],
  "keyword_suggestions": string[],
  "tailored_bullets": string[]
}
Rules:
- score is overall fit, 0-100.
- strengths are concise phrases present in the CV relevant to the job.
- gaps are concise phrases missing from the CV that are important for the job.
- keyword_suggestions are missing or weak keywords to add.
- tailored_bullets are 1-2 line impact bullets tailored to the job.
Return only JSON. Do not wrap in markdown. Do not add extra fields. Do not add explanations before or after.
Input:
<cv>
${cvText}
</cv>
<job_desc>
Title: ${title}
URL: ${url}
${jd}
</job_desc>`;

  const content = [
    { role: "system", content: instructions },
    {
      role: "user",
      content: `Job title: ${title}\nJob url: ${url}\nJob description:\n${jd}\n\nCV:\n${cvText}`,
    },
  ];

  return { messages: content };
}

function coerceAnalysisJson(text: any): AnalyzeResponse {
  if (!text) {
    return { summary: "Empty response from model" };
  }

  if (typeof text === "object") return text as AnalyzeResponse;

  if (typeof text === "string") {
    const trimmed = stripCodeFence(text.trim());
    try {
      const parsed = JSON.parse(trimmed);
      return parsed as AnalyzeResponse;
    } catch (_) {
      const match = findJsonBlock(trimmed);
      if (match) {
        try {
          return JSON.parse(match) as AnalyzeResponse;
        } catch (err) {
          console.warn("[CV Tailor][bg] JSON parse failed", err);
        }
      }
    }
    return { summary: trimmed.slice(0, 400) };
  }

  return { summary: "Unexpected response format" };
}

function extractCfText(data: any): any {
  if (!data) return "";

  const candidates = [
    data?.result?.response,
    data?.result?.output_text,
    data?.result?.output?.text,
    Array.isArray(data?.result?.output)
      ? data.result.output.map((o: any) => o?.text || o).join("\n")
      : null,
    data?.result?.choices?.[0]?.message?.content,
    data?.result?.choices?.[0]?.text,
    data?.result,
    data?.response,
    data,
  ];

  return candidates.find((c) => typeof c === "string" && c.trim().length > 0) || "";
}

function normalizeModel(model?: string) {
  if (!model) return "@cf/meta/llama-3.2-3b-instruct";
  const trimmed = model.trim();
  if (trimmed.startsWith("@")) return trimmed;
  return `@${trimmed}`;
}

function stripCodeFence(str: string) {
  return str.replace(/^\s*```(?:json)?/i, "").replace(/```$/, "").trim();
}

function findJsonBlock(str: string) {
  const first = str.indexOf("{");
  const last = str.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return str.slice(first, last + 1);
  }
  return null;
}
