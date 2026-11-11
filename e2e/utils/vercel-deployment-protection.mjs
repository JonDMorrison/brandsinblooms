const IMMUTABLE_DEPLOYMENT_HOST =
  /^brandsinblooms-[a-z0-9]+-brands-in-blooms\.vercel\.app$/i;

export function immutableDeploymentOrigin(baseURL) {
  if (!baseURL) return null;

  let url;
  try {
    url = new URL(baseURL);
  } catch {
    throw new Error("Playwright baseURL must be a valid URL");
  }

  if (!IMMUTABLE_DEPLOYMENT_HOST.test(url.hostname)) {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Expected the verified immutable Vercel deployment origin");
  }

  return url.origin;
}

export async function authenticateProtectedDeployment(
  context,
  baseURL,
  bypassSecret,
) {
  const origin = immutableDeploymentOrigin(baseURL);
  if (!origin) return false;
  if (!bypassSecret) {
    throw new Error(
      "VERCEL_AUTOMATION_BYPASS_SECRET is required for immutable deployment tests",
    );
  }

  const response = await context.request.get(origin, {
    headers: {
      "x-vercel-protection-bypass": bypassSecret,
      "x-vercel-set-bypass-cookie": "true",
    },
    failOnStatusCode: false,
    maxRedirects: 0,
    timeout: 15_000,
  });

  const location = response.headers().location;
  if (location && new URL(location, origin).origin !== origin) {
    throw new Error(
      "Deployment authentication redirected outside the verified origin",
    );
  }

  const hostname = new URL(origin).hostname;
  const cookies = await context.cookies(origin);
  const authenticated = cookies.some(
    (cookie) =>
      cookie.name === "_vercel_jwt" &&
      cookie.secure &&
      cookie.domain.replace(/^\./, "") === hostname,
  );

  if (response.status() >= 400 || !authenticated) {
    throw new Error(
      "Deployment authentication did not establish a scoped cookie",
    );
  }

  return true;
}
