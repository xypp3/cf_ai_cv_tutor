console.debug("[CV Tailor] Content script loaded on", window.location.href);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SCRAPE_JOB") {
    try {
      const scraped = scrapeJobDescription();
      console.debug("[CV Tailor][content] Scrape result", scraped);
      sendResponse({ ok: true, jobDescription: scraped });
    } catch (error) {
      console.error("[CV Tailor][content] Scrape error", error);
      sendResponse({ ok: false, error: (error as Error)?.message || String(error) });
    }
    return true;
  }
  return false;
});

type JobDescription = { title?: string; url?: string; text: string; source?: string };

function scrapeJobDescription(): JobDescription {
  const title =
    document.querySelector("h1")?.textContent?.trim() || document.title || "";
  const url = window.location.href;

  const ldJson = Array.from(
    document.querySelectorAll('script[type="application/ld+json"]')
  )
    .map((el) => {
      try {
        return JSON.parse(el.textContent || "{}");
      } catch (_) {
        return null;
      }
    })
    .find((data) => data && (data["@type"] === "JobPosting" || data.jobLocation));

  if (ldJson?.description) {
    return {
      title: ldJson.title || title,
      url,
      text: cleanText(ldJson.description),
      source: "ld+json",
    };
  }

  const mainSelectors = ["main", "article", ".job", ".job-description"];
  for (const selector of mainSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = cleanText(el.textContent || "");
      if (text.length > 200) {
        return { title, url, text, source: selector };
      }
    }
  }

  const fallback = cleanText(document.body?.innerText || "");
  return {
    title,
    url,
    text: fallback.slice(0, 8000),
    source: "body",
  };
}

function cleanText(str: string) {
  return (str || "")
    .replace(/\s+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();
}
