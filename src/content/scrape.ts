// Content script registers a scrape helper on window for background to call.
import { scrapeJobDescription } from "../lib/scrape";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.__CF_AI_CV_SCRAPE__ = function () {
  return scrapeJobDescription();
};
