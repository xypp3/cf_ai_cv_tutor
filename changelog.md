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

## 2024-XX-XX (Vite/React/TS/Tailwind)
- Converted extension to a Vite React TypeScript project with Tailwind styling (`extension/`).
- Added multi-entry build for popup, options, background, and content script via `vite.config.ts`, emitting stable filenames for MV2 manifest.
- React-based popup/options UIs live in `src/popup` and `src/options`; background/content scripts migrated to TypeScript in `src/background.ts` and `src/content-script.ts`.
- Added Tailwind + PostCSS configs and updated manifest (and public copy) to match built asset names.

## 2024-XX-XX (Cloudflare AI integration)
- Options now accept Cloudflare account ID, API token, and model; stored locally for direct Workers AI calls when mock mode is off and no custom analyze endpoint is provided.
- Background routes analysis to either a custom endpoint, or to Cloudflare AI via `accounts/{id}/ai/run/{model}` with a JSON-only prompt, and coerces the response into the expected analysis shape.
- Fixed CF AI URL construction (do not URL-encode the model path; normalize with leading @) and improved error logging/Accept headers.
