export function getSafeOAuthReturnTo(
  returnTo: string | null | undefined,
  origin: string = window.location.origin,
): string | null {
  if (!returnTo) return null;

  try {
    const url = new URL(returnTo, origin);
    const isOAuthRoute = url.pathname.startsWith("/oauth/");
    const isApprovedPartnerConnectRoute =
      url.pathname === "/integrations/lightspeed/connect";

    if (
      url.origin !== origin ||
      (!isOAuthRoute && !isApprovedPartnerConnectRoute)
    ) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
