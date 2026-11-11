/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase API URL; unset means the hosted project. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable (anon) key; unset means the hosted project's key. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Entri Application ID (publishable key, safe for frontend) */
  readonly VITE_ENTRI_APPLICATION_ID?: string;
  readonly VITE_HOMEPAGE_ENABLED?: string;
  readonly VITE_HOMEPAGE_ROLLOUT_PERCENT?: string;
  readonly VITE_HOMEPAGE_ROLLOUT_CONFIG_URL?: string;
  readonly VITE_HOMEPAGE_VARIANT?: "new" | "legacy";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
