const statusEl = document.getElementById("status");
const analyzeBtn = document.getElementById("analyze");
const resultEl = document.getElementById("result");
const cvStatusEl = document.getElementById("cv-status");
const optionsBtn = document.getElementById("open-options");

init();

async function init() {
  try {
    console.log("[CV Tailor][popup] init");
    await refreshCvStatus();
    analyzeBtn.addEventListener("click", handleAnalyzeClick);
    optionsBtn.addEventListener("click", openOptions);
  } catch (err) {
    console.error("[CV Tailor][popup] init error", err);
    setStatus("Init failed: " + (err?.message || err));
  }
}

async function refreshCvStatus() {
  const { cvText, mockMode } = await storageGet(["cvText", "mockMode"]);
  if (cvText && cvText.trim()) {
    const len = cvText.trim().length;
    cvStatusEl.textContent = `CV loaded (${len} chars). Mock mode: ${
      mockMode ? "on" : "off"
    }.`;
  } else {
    cvStatusEl.textContent =
      "No CV stored. Open Options to paste your CV text (required).";
  }
}

async function handleAnalyzeClick() {
  console.log("[CV Tailor][popup] Analyze click");
  setStatus("Scraping job description…");
  setResult("");

  const tab = await getActiveTab();
  if (!tab?.id) {
    console.error("[CV Tailor][popup] No active tab found");
    setStatus("Could not find active tab.");
    return;
  }

  const scrape = await scrapeJobFromTab(tab.id);
  if (!scrape.ok) {
    console.error("[CV Tailor][popup] Scrape failed", scrape.error);
    setStatus(`Scrape failed: ${scrape.error || "unknown error"}`);
    return;
  }

  console.log("[CV Tailor][popup] Scrape ok", scrape.jobDescription);
  setStatus("Analyzing via background…");
  chrome.runtime.sendMessage(
    { type: "ANALYZE_JOB", payload: { jobDescription: scrape.jobDescription } },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[CV Tailor][popup] Analyze message error",
          chrome.runtime.lastError
        );
        setStatus(`Analyze error: ${chrome.runtime.lastError.message}`);
        return;
      }
      if (!response?.ok) {
        console.error("[CV Tailor][popup] Analyze failed", response?.error);
        setStatus(`Analyze failed: ${response?.error || "unknown error"}`);
        return;
      }
      console.log("[CV Tailor][popup] Analysis result", response.result);
      setStatus("Analysis complete.");
      renderResult(response.result);
    }
  );
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setResult(html) {
  resultEl.innerHTML = html;
}

function renderResult(result) {
  if (!result) {
    setResult("No result.");
    return;
  }

  const {
    score,
    summary,
    strengths = [],
    gaps = [],
    keyword_suggestions = [],
  } = result;

  const html = `
    <div><strong>Score:</strong> ${score ?? "n/a"}</div>
    <div><strong>Summary:</strong> ${summary || "n/a"}</div>
    <div><strong>Strengths:</strong> ${strengths.join(", ") || "n/a"}</div>
    <div><strong>Gaps:</strong> ${gaps.join(", ") || "n/a"}</div>
    <div><strong>Keyword suggestions:</strong> ${
      keyword_suggestions.join(", ") || "n/a"
    }</div>
    <details style="margin-top:8px;"><summary>Raw JSON</summary><pre style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(
      JSON.stringify(result, null, 2)
    )}</pre></details>
  `;

  setResult(html);
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function openOptions() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("options.html"));
  }
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs?.[0]);
    });
  });
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response);
    });
  });
}

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[CV Tailor][popup] storage.get error",
          chrome.runtime.lastError
        );
      }
      resolve(result || {});
    });
  });
}

async function scrapeJobFromTab(tabId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const result = await Promise.race([
      sendMessageToTab(tabId, { type: "SCRAPE_JOB" }),
      new Promise((_, reject) =>
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

  // Fallback: inline executeScript scrape if content script unavailable.
  try {
    const [res] = await new Promise((resolve, reject) => {
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
          resolve(results || []);
        }
      );
    });
    console.log("[CV Tailor][popup] Fallback scrape ok", res);
    return res || { ok: false, error: "No result from fallback" };
  } catch (error) {
    console.error("[CV Tailor][popup] Fallback scrape failed", error);
    return { ok: false, error: error?.message || String(error) };
  }
}
