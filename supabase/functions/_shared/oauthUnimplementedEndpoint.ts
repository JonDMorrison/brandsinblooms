import { buildCorsHeaders, handleCorsPreflight } from "./cors.ts";

type UnimplementedEndpointOptions = {
  allowedMethods: string[];
  endpointName: string;
};

export function handleUnimplementedOAuthEndpoint(
  req: Request,
  options: UnimplementedEndpointOptions,
): Response {
  const allowMethods = [...options.allowedMethods, "OPTIONS"].join(", ");
  const corsResponse = handleCorsPreflight(req, {
    allowOrigin: "*",
    allowMethods,
  });

  if (corsResponse) {
    return corsResponse;
  }

  if (!options.allowedMethods.includes(req.method)) {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...buildCorsHeaders(req, { allowOrigin: "*", allowMethods }),
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Allow: allowMethods,
      },
    });
  }

  return new Response(
    JSON.stringify({ error: `${options.endpointName} is not implemented yet` }),
    {
      status: 501,
      headers: {
        ...buildCorsHeaders(req, { allowOrigin: "*", allowMethods }),
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}
