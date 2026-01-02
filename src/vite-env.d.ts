/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Entri Application ID (publishable key, safe for frontend) */
  readonly VITE_ENTRI_APPLICATION_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
