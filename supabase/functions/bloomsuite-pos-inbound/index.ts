import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { bloomSuitePosReceiver } from "../_shared/bloomsuite-pos.ts";

const service = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

Deno.serve(bloomSuitePosReceiver({
  async binding(key) {
    const { data, error } = await service.rpc("bloomsuite_pos_connection", { p_key: key });
    if (error) throw error;
    return data;
  },
  async apply(key, envelope) {
    const { data, error } = await service.rpc("accept_bloomsuite_pos_event", {
      p_key: key,
      p_envelope: envelope,
    });
    if (error) throw error;
    return data;
  },
}));
