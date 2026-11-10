import { corsJsonResponse, handleCorsPrelight } from "../_shared/cors.ts";

// This duplicate Twilio handler was never signature-verified. Consent and
// reply processing now live exclusively in the signed mta-webhook function.
Deno.serve((req) => {
  const preflight = handleCorsPrelight(req);
  if (preflight) return preflight;
  return corsJsonResponse(
    { error: "Legacy SMS reply webhook is retired; use mta-webhook" },
    { status: 410 },
  );
});
