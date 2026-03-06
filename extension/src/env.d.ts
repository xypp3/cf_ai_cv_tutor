/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_CV_TEXT?: string;
  readonly VITE_DEV_CF_ACCOUNT_ID?: string;
  readonly VITE_DEV_CF_API_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
