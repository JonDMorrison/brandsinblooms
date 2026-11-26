// Ambient types for Supabase Edge Function modules that the app imports and
// type-checks with tsconfig.app.json (shared helpers under supabase/functions
// that run in both the browser bundle's tests and Deno).
//
// Deno resolves `npm:` and `https:` specifiers at runtime; the app type-check
// does not, so map them to the same packages installed for the app. Only the
// part of the Deno namespace those shared modules use is declared.

declare module "npm:@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}

declare module "npm:@supabase/supabase-js@2.117.2" {
  export * from "@supabase/supabase-js";
}

declare module "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs" {
  export * from "xlsx";
}

declare namespace Deno {
  interface Env {
    get(key: string): string | undefined;
  }
  const env: Env;
}
