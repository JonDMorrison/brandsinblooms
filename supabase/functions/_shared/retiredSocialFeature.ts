const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

export function retiredSocialFeatureResponse(request: Request): Response {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  return new Response(
    JSON.stringify({
      error: "Social media management has been retired from BloomSuite.",
      code: "FEATURE_RETIRED",
    }),
    { status: 410, headers },
  );
}
