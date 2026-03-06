import { useEffect, useState } from "react";

export default function OptionsApp() {
  const [cvText, setCvText] = useState("");
  const [mockMode, setMockMode] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    chrome.storage.local.get(["cvText", "mockMode", "analyzeEndpoint"], (data) => {
      if (chrome.runtime.lastError) {
        setStatus(chrome.runtime.lastError.message);
        return;
      }
      setCvText(data.cvText || "");
      setMockMode(Boolean(data.mockMode));
      setEndpoint(data.analyzeEndpoint || "");
    });
  }, []);

  const handleSave = () => {
    chrome.storage.local.set(
      { cvText, mockMode, analyzeEndpoint: endpoint },
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
