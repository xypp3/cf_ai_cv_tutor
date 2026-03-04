// Popup script: trigger analyze, show results (placeholder).
import { AnalysisResult } from "../lib/ai";

function setStatus(text: string) {
  const el = document.getElementById("status");
  if (el) el.textContent = text;
}

function renderResult(result: AnalysisResult) {
  const el = document.getElementById("result");
  if (!el) return;
  el.innerHTML = `
    <div>Score: ${result.score}</div>
    <div>Summary: ${result.summary}</div>
    <div>Top gaps:<ul>${result.gaps.slice(0, 3).map((g) => `<li>${g}</li>`).join("")}</ul></div>
  `;
}

async function analyzeCurrentTab() {
  setStatus("Analyzing...");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) return setStatus("No active tab");
  const response = await chrome.runtime.sendMessage({ type: "SCRAPE_AND_ANALYZE", tabId: tab.id });
  if (!response?.ok) {
    setStatus(`Error: ${response?.error || "unknown"}`);
    return;
  }
  renderResult(response.analysis as AnalysisResult);
  setStatus("Done");
}

async function openEditor() {
  await chrome.runtime.sendMessage({ type: "OPEN_EDITOR" });
}

document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyze-btn");
  const editBtn = document.getElementById("edit-btn");
  analyzeBtn?.addEventListener("click", analyzeCurrentTab);
  editBtn?.addEventListener("click", openEditor);
});
