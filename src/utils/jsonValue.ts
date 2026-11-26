import { isJsonValue } from "@/hooks/bloom/taskPlanTypes";
import type { Json } from "@/integrations/supabase/types";

/**
 * Converts an in-memory value into the `Json` shape a Supabase json/jsonb
 * column accepts, using the same JSON serialization the Supabase client
 * applies to the request body (undefined fields dropped, Dates via toJSON).
 * Values JSON cannot represent at all (undefined, functions) become null.
 */
export function toJsonValue(value: unknown): Json {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    return null;
  }

  const parsed: unknown = JSON.parse(serialized);
  return isJsonValue(parsed) ? parsed : null;
}
