import { corsJsonResponse, handleCorsPrelight } from "../_shared/cors.ts";

// BloomSuite no longer uses Twilio for inbound SMS. Keeping this retired
// endpoint inert prevents legacy unsigned callbacks from mutating consent.
Deno.serve((req) => {
  const preflight = handleCorsPrelight(req);
  if (preflight) return preflight;
  return corsJsonResponse(
    { error: "Twilio inbound SMS is retired; use the signed Mobile Text Alerts webhook" },
    { status: 410 },
  );
});
