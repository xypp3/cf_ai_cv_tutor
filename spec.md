# Browser Extension + CF AI CV Tuning (Plan)

## Goal
WebExtension (Chrome + Firefox) that analyzes a job page, compares it to the user’s DOCX CV, suggests edits, lets the user tailor the CV in a rich editor, exports a nicely formatted PDF/DOCX, and assists with upload.

## Surfaces
- Popup: “Analyze this job” trigger, shows score + top gaps + “Edit CV”.
- Content script: on-demand scrape of job description from current tab.
- Options page: upload/manage default CV (DOCX), connect Google Doc (optional), Cloudflare creds, style presets.
- Editor tab: TipTap-based rich editor with suggestions panel and export buttons.

## Data + Storage
- CV source of truth: user-uploaded DOCX (via options page) stored locally (encrypted) and optionally mirrored to Cloudflare R2.
- Derived text: Worker converts DOCX to structured plaintext/JSON (headings, bullets) cached with hash of DOCX in R2/KV; extension fetches this for AI.
- Optional Google Docs: short-lived Drive export to DOCX -> stored in R2 -> same text derivation.
- Secrets (CF token, Google token) only in `storage.local` (never sync).

## Cloudflare Worker APIs
- `POST /cv/upload` (authorized): store DOCX in R2, return hash.
- `GET /cv/latest` -> stream DOCX; `GET /cv/plain` -> structured text/JSON (computed if hash mismatch).
- `POST /analyze` with `{ job_description, cv_text, target_role }` -> Workers AI JSON `{ score, summary, strengths[], gaps[], suggested_edits[], tailored_bullets[] }`.

## Cloudflare Worker & AI details
- Storage: R2 bucket holds raw DOCX; KV (or D1) tracks metadata `{hash, updated_at, source: manual_upload|google_drive}` and caches derived plaintext/JSON keyed by hash.
- Upload path: options page sends `multipart/form-data` with DOCX to `/cv/upload`; Worker streams to R2, computes hash, updates KV, immediately derives plaintext/JSON for cache.
- Google Docs path: options page passes short-lived Drive access token + doc id to `/cv/upload/google`; Worker fetches export as DOCX, stores to R2, same derivation and caching.
- AI call: `/analyze` uses Workers AI (e.g., `@cf/meta/llama-3.1-8b-instruct` or `@cf/mistral/mistral-7b-instruct`) with a strict JSON schema enforced by prompt + response validator; retries with temperature=0.2 on schema failure.
- Response schema (example): `{ score: number 0-100, summary: string <= 80 words, strengths: string[], gaps: string[], suggested_edits: [{ section, before, after, rationale }], tailored_bullets: string[] }`.
- Security: require bearer token (user-provided CF API token) on Worker endpoints; consider signed, short-lived upload URLs if direct uploads are preferred. No secrets stored in Worker responses; no sync storage for tokens.

## User Flow
1) User installs extension, opens Options, uploads default DOCX (or links Google Doc); Worker caches text.
2) On a job page, user opens popup and hits “Analyze this job”.
3) Content script scrapes JD (visible text + ld+json) and sends to background.
4) Background fetches CV text from Worker, calls `/analyze`, shows score + suggestions in popup with “Edit CV”.
5) “Edit CV” opens Editor tab with TipTap; loads DOCX-converted HTML + suggestion highlights (accept/reject).
6) User exports PDF (client pdf-lib or Worker render) and/or DOCX; file ready for upload.
7) Upload helper tries to populate site file input; otherwise prompts user to click upload and auto-fills if permitted.

## Scraping Heuristics (on-demand)
- Prefer `application/ld+json` JobPosting; fallback selectors: `[role=main]`, `article`, `.job`, `.description`, `.job-description`.
- Strip nav/footer/scripts; preserve bullet structure; include page URL/title.

## Editor + Export
- TipTap (ProseMirror) with suggestion sidebar; sections mapped from DOCX headings.
- Autosave drafts to local encrypted storage; optional save-back of edited DOCX via Worker (`docx` lib).
- PDF: templated styling (margins, headers, bullet spacing). DOCX export via `docx` library.

## Permissions/Manifest
- Manifest v3; `activeTab`, `scripting`, `storage`, `downloads`, `tabs`; optional `identity` for Google OAuth; `browser_specific_settings` for Firefox.
- Use `webextension-polyfill` for cross-browser API.

## Open Decisions
- Where to run PDF render (client vs Worker headless chrome) based on fidelity/perf.
- Encryption approach for local DOCX (WebCrypto AES-GCM with user passphrase?).
- Site-specific upload helpers gated behind feature flags.

## Tech
Vite - bundling, to run vite always use "npx vite ..."
ReactJs - UI library
WorkersAI - Cloudflare workers AI for AI model

## MVP
1. User prompt to upload CV as plaintext
2. On job website, button to scrape contents and send contents + CV to WorkersAI for analysis
3. Return score and also some key word changes
