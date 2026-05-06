export function getSafeOAuthReturnTo(
  returnTo: string | null | undefined,
  origin: string = window.location.origin,
): string | null {
  if (!returnTo) return null;

  try {
    const url = new URL(returnTo, origin);
    if (url.origin !== origin || !url.pathname.startsWith("/oauth/")) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
