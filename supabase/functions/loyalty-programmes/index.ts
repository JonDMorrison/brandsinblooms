import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createProgrammeHandler } from "../_shared/loyalty/programme-service.ts";

Deno.serve(
  createProgrammeHandler({
    userClient: (authorization) =>
      createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        {
          global: { headers: { Authorization: authorization } },
          auth: { persistSession: false, autoRefreshToken: false },
        },
      ),
    serviceClient: () =>
      createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
        },
      ),
  }),
);
