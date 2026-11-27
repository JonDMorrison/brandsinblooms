// Retired edge functions: answer 410 Gone and record who still calls them,
// so a missed caller shows up in the function logs before the function is
// deleted. See "Retirement log" in docs/bloom-newsletter-audit.md.

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/** Log the caller of a retired function (origin, referer, user agent, method). */
export function logRetiredFunctionCall(request: Request, functionName: string): void {
  if (request.method === "OPTIONS") return;
  console.warn(
    JSON.stringify({
      event: "retired_function_called",
      function: functionName,
      method: request.method,
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      user_agent: request.headers.get("user-agent"),
    }),
  );
}

/** 410 Gone for a retired function; the caller is logged first. */
export function retiredFunctionResponse(request: Request, functionName: string): Response {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers });
  }
  logRetiredFunctionCall(request, functionName);
  return new Response(
    JSON.stringify({
      error: `${functionName} has been retired from BloomSuite.`,
      code: "FUNCTION_RETIRED",
    }),
    { status: 410, headers },
  );
}
