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
  /** BloomSuite central login: "on" offers "Continue with BloomSuite" on /auth. */
  readonly VITE_BLOOMSUITE_LOGIN?: string;
  /** "on" keeps the CRM's own email sign-in and sign-up (always shown while VITE_BLOOMSUITE_LOGIN is off). */
  readonly VITE_LEGACY_EMAIL_LOGIN?: string;
  /** BloomSuite ID's web address (its Account Center is <address>/account). */
  readonly VITE_BLOOMSUITE_WEB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
