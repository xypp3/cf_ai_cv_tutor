## 2024-XX-XX
- Trim MVP to popup + background + content script: upload plaintext CV, scrape job description, call `/analyze`, show score + top gaps/keywords; defer TipTap editor, export, encryption, Google Docs, and upload helper to later versions.
- Store CV plaintext in `storage.local` with version/hash and a “replace CV” flow; keep tokens separate for revocation simplicity.
- Lock minimal `/analyze` API contract early (e.g., `{score, summary, gaps[], keyword_suggestions[]}`) so UI can progress independently.
- Scraping: prefer structured JobPosting, fall back to main text with URL/title; surface a “scrape failed” state.
- Popup UX: prominent “Analyze this job” CTA, loading state, and small results panel (score + 3 gaps + “view details” opening a simple HTML page with JSON for MVP).
- Permissions: MVP keeps `activeTab`, `scripting`, `storage`; defer `downloads`, `tabs`, `identity` until export/Google features land; document that CV is stored locally in plaintext.
- Add error handling: retry button and “copy payload” for debugging; include mock mode toggle in options to develop UI without Worker.

## 2024-XX-XX (MVP scaffold)
- Added Firefox-ready MV2 extension scaffold with popup, background, content script, and options page.
- Popup now scrapes the active tab, sends it to background, and renders mock/real analysis results with raw JSON.
- Options page lets users paste plaintext CV, toggle mock mode, and set an analyze endpoint.
