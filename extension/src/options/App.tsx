import { useEffect, useState } from "react";

export default function OptionsApp() {
  const devDefaults = getDevDefaults();
  const isDevMode = import.meta.env.DEV || import.meta.env.MODE === "development";

  const [cvText, setCvText] = useState(devDefaults.cvText);
  const [mockMode, setMockMode] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const [cfAccountId, setCfAccountId] = useState(devDefaults.cfAccountId);
  const [cfApiToken, setCfApiToken] = useState(devDefaults.cfApiToken);
  const [cfModel, setCfModel] = useState("@cf/meta/llama-3.2-3b-instruct");
  const [status, setStatus] = useState("");

  useEffect(() => {
    chrome.storage.local.get(
      ["cvText", "mockMode", "analyzeEndpoint", "cfAccountId", "cfApiToken", "cfModel"],
      (data) => {
        if (chrome.runtime.lastError) {
          setStatus(chrome.runtime.lastError.message);
          return;
        }
        setCvText(data.cvText || devDefaults.cvText);
        setMockMode(Boolean(data.mockMode));
        setEndpoint(data.analyzeEndpoint || "");
        setCfAccountId(data.cfAccountId || devDefaults.cfAccountId);
        setCfApiToken(data.cfApiToken || devDefaults.cfApiToken);
        setCfModel(data.cfModel || "@cf/meta/llama-3.2-3b-instruct");

        const shouldSeed =
          isDevMode &&
          devDefaults.hasAny &&
          !(data.cvText || data.cfAccountId || data.cfApiToken);
        if (shouldSeed) {
          chrome.storage.local.set(
            {
              cvText: devDefaults.cvText,
              cfAccountId: devDefaults.cfAccountId,
              cfApiToken: devDefaults.cfApiToken,
            },
            () => {
              if (chrome.runtime.lastError) {
                console.warn(
                  "[CV Tailor][options] Auto-save dev defaults failed",
                  chrome.runtime.lastError
                );
              }
            }
          );
        }
      }
    );
  }, []);

  const handleSave = () => {
    chrome.storage.local.set(
      {
        cvText,
        mockMode,
        analyzeEndpoint: endpoint,
        cfAccountId,
        cfApiToken,
        cfModel,
      },
      () => {
        if (chrome.runtime.lastError) {
          setStatus(chrome.runtime.lastError.message);
          return;
        }
        setStatus("Saved");
        setTimeout(() => setStatus(""), 1500);
      }
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <header>
          <p className="text-xs uppercase tracking-wide text-slate-400">CV Tailor</p>
          <h1 className="text-2xl font-bold">Options</h1>
          <p className="text-sm text-slate-300">
            Paste your CV as plaintext and toggle mock analysis for offline testing.
          </p>
        </header>

        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-100">
            CV Text
            <textarea
              className="mt-2 w-full min-h-[200px] rounded border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Paste your CV text here"
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={mockMode}
              onChange={(e) => setMockMode(e.target.checked)}
            />
            Enable mock analysis (no network request)
          </label>

          <label className="block text-sm font-semibold text-slate-100">
            Analyze endpoint (optional)
            <input
              type="url"
              className="mt-2 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder="https://example.com/analyze"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-slate-100">
            Cloudflare Account ID
            <input
              className="mt-2 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="xxxxxxxxxxxxxxxxxxxx"
              value={cfAccountId}
              onChange={(e) => setCfAccountId(e.target.value)}
            />
          </label>

        <label className="block text-sm font-semibold text-slate-100">
          Cloudflare AI Model
          <input
            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="@cf/meta/llama-3.2-3b-instruct"
              value={cfModel}
              onChange={(e) => setCfModel(e.target.value)}
            />
          </label>
        </div>

        <label className="block text-sm font-semibold text-slate-100">
          Cloudflare API Token (AI/Workers)
          <input
            type="password"
            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="Bearer token"
            value={cfApiToken}
            onChange={(e) => setCfApiToken(e.target.value)}
          />
          <p className="text-xs text-slate-400 mt-1">
            Stored locally only. Used when mock mode is off and no custom analyze endpoint
            is set.
          </p>
        </label>
      </div>

        <div className="flex items-center gap-3">
          <button
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold px-4 py-2 rounded"
            onClick={handleSave}
          >
            Save
          </button>
          <span className="text-sm text-slate-300">{status}</span>
        </div>
      </div>
    </div>
  );
}

function getDevDefaults() {
  const isDevMode = import.meta.env.DEV || import.meta.env.MODE === "development";
  if (!isDevMode)
    return { cvText: "", cfAccountId: "", cfApiToken: "", hasAny: false };
  const cvText = import.meta.env.VITE_DEV_CV_TEXT || "";
  const cfAccountId = import.meta.env.VITE_DEV_CF_ACCOUNT_ID || "";
  const cfApiToken = import.meta.env.VITE_DEV_CF_API_TOKEN || "";
  const hasAny = Boolean(cvText || cfAccountId || cfApiToken);
  return { cvText, cfAccountId, cfApiToken, hasAny };
}
