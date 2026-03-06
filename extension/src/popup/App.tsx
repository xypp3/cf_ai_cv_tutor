import { useEffect, useMemo, useState } from "react";
import type { AnalyzeResponse } from "../types";

type JobDescription = { title?: string; url?: string; text: string; source?: string };

type ScrapeResult =
  | { ok: true; jobDescription: JobDescription }
  | { ok: false; error?: string };

const initialResultState: AnalyzeResponse | null = null;

export default function App() {
  const [cvStatus, setCvStatus] = useState("Checking CV…");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(initialResultState);
  const [status, setStatus] = useState("Waiting…");

  useEffect(() => {
    refreshCvStatus();
  }, []);

  const statusColor = useMemo(() => {
    if (loading) return "text-amber-300";
    if (status.toLowerCase().includes("fail") || status.toLowerCase().includes("error"))
      return "text-red-300";
    return "text-slate-200";
  }, [status, loading]);

  async function refreshCvStatus() {
    const { cvText, mockMode } = await storageGet(["cvText", "mockMode"]);
    if (cvText && cvText.trim()) {
      const len = cvText.trim().length;
      setCvStatus(
        `CV loaded (${len} chars). Mock mode: ${mockMode ? "on" : "off"}.`
      );
    } else {
      setCvStatus("No CV stored. Use Add CV to open options.");
    }
  }

  async function handleAnalyze() {
    setLoading(true);
    setStatus("Scraping job description…");
    setResult(null);

    const tab = await getActiveTab();
    if (!tab?.id) {
      setStatus("Could not find active tab.");
      setLoading(false);
      return;
    }

    const scrape = await scrapeJobFromTab(tab.id);
    if (!scrape.ok) {
      setStatus(`Scrape failed: ${scrape.error || "unknown error"}`);
      setLoading(false);
      return;
    }

    setStatus("Analyzing via background…");
    chrome.runtime.sendMessage(
      { type: "ANALYZE_JOB", payload: { jobDescription: scrape.jobDescription } },
      (response) => {
        setLoading(false);
        if (chrome.runtime.lastError) {
          setStatus(`Analyze error: ${chrome.runtime.lastError.message}`);
          return;
        }
        if (!response?.ok) {
          setStatus(`Analyze failed: ${response?.error || "unknown error"}`);
          return;
        }
        setStatus("Analysis complete.");
        setResult(response.result as AnalyzeResponse);
      }
    );
  }

  return (
    <div className="min-w-[280px] max-w-[360px] p-4 space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">CV Tailor</p>
          <p className="text-sm text-slate-200">{cvStatus}</p>
        </div>
        <button
          className="text-xs px-2 py-1 rounded border border-slate-600 bg-slate-800 hover:bg-slate-700"
          onClick={openOptions}
        >
          Add CV
        </button>
      </header>

      <button
        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold py-2 rounded disabled:opacity-50"
        onClick={handleAnalyze}
        disabled={loading}
      >
        {loading ? "Working…" : "Analyze this job"}
      </button>

      <p className={`text-xs ${statusColor}`}>{status}</p>

      {result && <ResultCard result={result} />}
    </div>
  );
}

function ResultCard({ result }: { result: AnalyzeResponse }) {
  const {
    score,
    summary,
    strengths = [],
    gaps = [],
    keyword_suggestions = [],
    _raw_text,
  } = result;

  return (
    <div className="rounded border border-slate-700 bg-slate-900 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-100">Results</p>
        <span className="text-sm text-emerald-300">Score: {score ?? "n/a"}</span>
      </div>
      <p className="text-sm text-slate-200">{summary || "No summary"}</p>
      <KV label="Strengths" value={strengths.join(", ") || "n/a"} />
      <KV label="Gaps" value={gaps.join(", ") || "n/a"} />
      <KV
        label="Keyword suggestions"
        value={keyword_suggestions.join(", ") || "n/a"}
      />
      <details className="text-xs text-slate-400">
        <summary className="cursor-pointer">Raw JSON</summary>
        <pre className="whitespace-pre-wrap break-words mt-1">
{JSON.stringify(result, null, 2)}
        </pre>
      </details>
      {_raw_text && (
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer">Raw text</summary>
          <pre className="whitespace-pre-wrap break-words mt-1">{_raw_text}</pre>
        </details>
      )}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs text-slate-300">
      <span className="font-semibold text-slate-200">{label}:</span> {value}
    </div>
  );
}

function openOptions() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("options.html"));
  }
}

function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs?.[0]);
    });
  });
}

function sendMessageToTab<T>(tabId: number, message: unknown) {
  return new Promise<T>((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message } as unknown as T);
        return;
      }
      resolve(response as T);
    });
  });
}

async function scrapeJobFromTab(tabId: number): Promise<ScrapeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const result = await Promise.race([
      sendMessageToTab<ScrapeResult>(tabId, { type: "SCRAPE_JOB" }),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener("abort", () =>
          reject(new Error("Content script not responding"))
        )
      ),
    ]);
    clearTimeout(timeout);
    if (result) return result;
  } catch (err) {
    clearTimeout(timeout);
    console.warn("[CV Tailor][popup] Content script message failed, fallback", err);
  }

  try {
    const [res] = await new Promise<ScrapeResult[]>((resolve, reject) => {
      chrome.tabs.executeScript(
        tabId,
        {
          code: `
            (function() {
              const title = document.querySelector("h1")?.textContent?.trim() || document.title || "";
              const text = (document.querySelector("main") || document.body)?.innerText || "";
              const cleaned = text.replace(/\\s+/g, " ").trim().slice(0, 8000);
              return { ok: true, jobDescription: { title, url: location.href, text: cleaned, source: "fallback-executeScript" } };
            })();
          `,
          runAt: "document_idle",
        },
        (results) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(results as ScrapeResult[]);
        }
      );
    });
    return res || { ok: false, error: "No result from fallback" };
  } catch (error) {
    return { ok: false, error: (error as Error)?.message || String(error) };
  }
}

function storageGet(keys: string[]) {
  return new Promise<Record<string, any>>((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        console.error("[CV Tailor][popup] storage.get error", chrome.runtime.lastError);
      }
      resolve(result || {});
    });
  });
}
