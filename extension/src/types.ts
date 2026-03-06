export type AnalyzeRequest = {
  jobDescription: { title?: string; url?: string; text: string; source?: string };
};

export type AnalyzeResponse = {
  score?: number;
  summary?: string;
  strengths?: string[];
  gaps?: string[];
  keyword_suggestions?: string[];
  tailored_bullets?: string[];
  [key: string]: unknown;
};
