// Job description scraping heuristics (content script side).

const JOB_SELECTORS = [
  "[role=main]",
  "article",
  ".job",
  ".job-description",
  ".description",
  ".jobdesc",
  ".job_details",
  ".posting"
];

function textFromNode(node: Element): string {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const text = n.textContent || "";
      return text.trim().length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const parts: string[] = [];
  while (walker.nextNode()) parts.push((walker.currentNode.textContent || "").trim());
  return parts.join("\n");
}

export function extractJobPostingJsonLd(): string | null {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    try {
      const json = JSON.parse(script.textContent || "{}");
      if (json["@type"] === "JobPosting" || (Array.isArray(json["@graph"]) && json["@graph"].some((n) => n["@type"] === "JobPosting"))) {
        return script.textContent || null;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function scrapeJobDescription(): { title?: string; company?: string; text: string } {
  const ld = extractJobPostingJsonLd();
  if (ld) {
    try {
      const parsed = JSON.parse(ld);
      if (parsed["@type"] === "JobPosting") {
        const desc = typeof parsed.description === "string" ? parsed.description : "";
        return { title: parsed.title, company: parsed.hiringOrganization?.name, text: desc };
      }
      if (Array.isArray(parsed["@graph"])) {
        const job = parsed["@graph"].find((n: any) => n["@type"] === "JobPosting");
        if (job) {
          const desc = typeof job.description === "string" ? job.description : "";
          return { title: job.title, company: job.hiringOrganization?.name, text: desc };
        }
      }
    } catch {
      // fall through to heuristic scrape
    }
  }

  for (const selector of JOB_SELECTORS) {
    const el = document.querySelector(selector);
    if (el) {
      return { text: textFromNode(el) };
    }
  }

  const bodyText = textFromNode(document.body);
  return { text: bodyText };
}
