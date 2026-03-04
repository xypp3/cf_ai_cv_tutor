// Local storage helpers (placeholder; wire to webextension-polyfill in build).
// Tokens should stay in local-only storage; consider encrypting with user passphrase.

export type Secrets = {
  workerBase?: string; // e.g., https://your-worker.example.workers.dev
  workerToken?: string; // bearer token for Worker auth
  targetRole?: string;
};

export async function saveSecrets(secrets: Secrets): Promise<void> {
  await chrome.storage.local.set({ secrets });
}

export async function loadSecrets(): Promise<Secrets> {
  const { secrets } = await chrome.storage.local.get("secrets");
  return (secrets as Secrets) || {};
}

export type CvMetadata = {
  hash?: string;
  updated_at?: string;
  source?: "manual_upload" | "google_drive";
};

export async function saveCvMetadata(meta: CvMetadata): Promise<void> {
  await chrome.storage.local.set({ cvMeta: meta });
}

export async function loadCvMetadata(): Promise<CvMetadata> {
  const { cvMeta } = await chrome.storage.local.get("cvMeta");
  return (cvMeta as CvMetadata) || {};
}

export type CvPlainCache = {
  full_text: string;
  hash: string;
  updated_at: string;
  source: "manual_upload" | "google_drive";
};

export async function saveCvPlainCache(cache: CvPlainCache): Promise<void> {
  await chrome.storage.local.set({ cvPlain: cache });
}

export async function loadCvPlainCache(): Promise<CvPlainCache | null> {
  const { cvPlain } = await chrome.storage.local.get("cvPlain");
  return (cvPlain as CvPlainCache) || null;
}
