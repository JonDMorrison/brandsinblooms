// A local stack sets VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (in the
// git-ignored .env.local). Without them a build talks to the hosted project, as before.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://udldmkqwnxhdeztyqcau.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_iKrafIfqem0wBWT51FqNpQ_KBHmF2El";
