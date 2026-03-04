// Background/service worker entry: orchestrates scrape -> AI analyze -> editor open.
// Note: wire to webextension-polyfill and bundler outputs later.

import { analyze, fetchCvPlain, AnalysisResult } from "../lib/ai";
import { loadSecrets, loadCvPlainCache } from "../lib/storage";

type AnalyzeMessage =
  | { type: "SCRAPE_AND_ANALYZE"; tabId: number }
  | { type: "OPEN_EDITOR"; analysis?: AnalysisResult };

async function scrapeFromTab(tabId: number) {
  if (chrome.scripting?.executeScript) {
    const [{ result }] = await chrome.scripting.executeScript<{ result: any }[]>({
      target: { tabId },
      func: () => {
        // injected into page to run scrape in content context
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return window.__CF_AI_CV_SCRAPE__?.() ?? null;
      }
    });
    return result;
  }

  return new Promise<any>((resolve, reject) => {
    // Fallback for Firefox MV3 (background scripts) until service workers are enabled.
    chrome.tabs.executeScript(
      tabId,
      { code: "window.__CF_AI_CV_SCRAPE__ && window.__CF_AI_CV_SCRAPE__()" },
      (results) => {
        const [result] = results || [];
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        resolve(result ?? null);
      }
    );
  });
}

async function handleAnalyze(tabId: number): Promise<AnalysisResult> {
  const secrets = await loadSecrets();
  if (!secrets.workerBase || !secrets.workerToken) throw new Error("Worker configuration missing");

  const result = await scrapeFromTab(tabId);

  if (!result || !result.text) throw new Error("Scrape failed");

  const cached = await loadCvPlainCache();
  const cv = cached
    ? { full_text: cached.full_text }
    : await fetchCvPlain(secrets.workerBase, secrets.workerToken);
  return analyze(secrets.workerBase, secrets.workerToken, {
    job_description: result.text,
    cv_text: cv.full_text,
    target_role: secrets.targetRole
  });
}

chrome.runtime.onMessage.addListener((msg: AnalyzeMessage, sender, sendResponse) => {
  if (msg.type === "SCRAPE_AND_ANALYZE" && sender.tab?.id) {
    handleAnalyze(sender.tab.id)
      .then((analysis) => sendResponse({ ok: true, analysis }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // async
  }
  if (msg.type === "OPEN_EDITOR") {
    chrome.tabs.create({ url: "editor.html" });
    sendResponse({ ok: true });
  }
  return undefined;
});
