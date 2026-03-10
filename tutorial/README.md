# CF AI CV Tune – Guided Tour Demo

This React + `react-shepherd` overlay runs as a content-script style tour, so you can place it on top of any job page while you record. It mirrors the MVP flow from `spec.md`: upload a CV, scrape the job, analyze with Workers AI, tailor in the editor, and export for upload.

## Quick start (overlay on any page)
1) Install deps in `tutorial/`: `npm install`
2) Start the dev server: `npm run dev` (serves the overlay module)
3) On the job page you’re demoing, paste this once in the console to load the overlay:
   ```js
   import("http://localhost:5174/src/inject.tsx");
   ```
   (Or save it as a bookmarklet: `javascript:import('http://localhost:5174/src/inject.tsx')`)
4) Click **Start guided tour**; use **Next/Back** or hit **Esc** to exit. Use **Hide tutorial** to remove the overlay.

## Shipping as a temporary content script (optional)
- Build once to emit a single `overlay.js`: `npm run build`
- Copy `tutorial/dist/overlay.js` into your extension bundle and add it as a temporary content script in `manifest.json` for demo builds:
  ```json
  {
    "matches": ["<all_urls>"],
    "js": ["tutorial/overlay.js"],
    "run_at": "document_idle"
  }
  ```
- Reload the unpacked extension; the overlay will mount automatically. Remove this entry when you’re done recording.

## Notes
- The tour highlights the MVP beats: `Upload & cache`, `Scrape & analyze`, `Editor & export`, plus AI insights and tailored bullets.
- Copy is mock but mirrors the expected API outputs (score, strengths, gaps, tailored bullets).
- To auto-start the tour on load, set `tour.start()` in `src/App.tsx` or trigger `tour.show("welcome")` from `TourButtons`.
