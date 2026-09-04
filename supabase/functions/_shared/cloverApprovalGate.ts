const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-clover-auth-token",
  "Content-Type": "application/json",
};

/**
 * Clover remains staged until the vendor grants formal API approval and the
 * final production contract is verified. The default is deliberately closed;
 * deployment configuration must opt in after that review is complete.
 */
export function requireCloverApproval(request: Request): Response | null {
  if (Deno.env.get("CLOVER_INTEGRATION_APPROVED") === "true") {
    return null;
  }

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: "Clover integration is awaiting formal API approval.",
      code: "VENDOR_APPROVAL_PENDING",
    }),
    { status: 503, headers: corsHeaders },
  );
}
