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
  const maxTokens = 20000;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      // Disable streaming; read full body to avoid partial JSON.
      body: JSON.stringify({
        ...prompt,
        stream: false,
        max_output_tokens: maxTokens,
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
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

  const rawText = await readResponseBody(response);
  console.debug("[CV Tailor][bg] CF AI raw text", rawText);

  const mergedText = parseSseText(rawText) ?? rawText;
  console.debug("[CV Tailor][bg] CF AI merged text", mergedText);

  let data: any;
  try {
    data = JSON.parse(mergedText);
  } catch (_) {
    data = undefined;
  }

  if (data?.result && typeof data.result === "object" && !Array.isArray(data.result)) {
    if ("score" in data.result || "summary" in data.result) {
      return data.result as AnalyzeResponse;
    }
  }

  const text = data ? extractCfText(data) : mergedText;
  console.debug("[CV Tailor][bg] CF AI extracted text", text);
  const parsed = coerceAnalysisJson(text);
  if (!parsed.summary && text) {
    parsed.summary = typeof text === "string" ? text.slice(0, 400) : "Parsed with no summary";
  }
  return { ...parsed, _raw_text: typeof text === "string" ? text : undefined };
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
          console.warn("[CV Tailor][bg] JSON parse failed", err, "match:", match);
        }
      }
      console.warn("[CV Tailor][bg] Could not parse, returning trimmed summary");
    }
    return { summary: trimmed.slice(0, 400) };
  }

  return { summary: "Unexpected response format" };
}

function extractCfText(data: any): any {
  if (!data) return "";

  const candidates: string[] = [];

  const pushMaybe = (v: any) => {
    if (typeof v === "string" && v.trim().length > 0) candidates.push(v.trim());
  };

  pushMaybe(data?.result?.choices?.[0]?.message?.content);
  pushMaybe(data?.result?.choices?.[0]?.text);
  pushMaybe(data?.result?.response);
  pushMaybe(data?.result?.output_text);
  pushMaybe(data?.result?.output?.text);
  if (Array.isArray(data?.result?.output)) {
    const joined = data.result.output.map((o: any) => o?.text || o).join("\n");
    pushMaybe(joined);
  }
  pushMaybe(data?.response);
  pushMaybe(data?.result);
  pushMaybe(typeof data === "string" ? data : "");

  if (candidates.length === 0) return "";

  const withBraces = candidates.filter((c) => c.includes("{") && c.includes("}"));
  if (withBraces.length > 0) {
    return withBraces.sort((a, b) => b.length - a.length)[0];
  }

  return candidates.sort((a, b) => b.length - a.length)[0];
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

async function readResponseBody(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return response.text();
  }

  const decoder = new TextDecoder();
  let done = false;
  const chunks: string[] = [];

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    if (value) {
      chunks.push(decoder.decode(value, { stream: true }));
    }
    done = readerDone;
  }
  chunks.push(decoder.decode());

  return chunks.join("");
}

function parseSseText(text: string): string | null {
  if (!text || !text.includes("data:")) return null;
  const lines = text.split(/\r?\n/);
  let aggregated = "";

  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const payload = line.replace(/^data:\s*/, "");
    if (payload === "[DONE]") break;
    try {
      const obj = JSON.parse(payload);
      if (typeof obj.response === "string") aggregated += obj.response;
      else if (typeof obj.output_text === "string") aggregated += obj.output_text;
      else if (typeof obj.p === "string") aggregated += obj.p;
      else if (typeof obj.delta === "string") aggregated += obj.delta;
      else if (obj?.choices?.[0]?.delta?.content) {
        aggregated += obj.choices[0].delta.content;
      }
    } catch (_) {
      // ignore malformed SSE chunk
    }
  }

  return aggregated || null;
}
