/**
 * Public showroom only. The CRM showroom works entirely in this browser, so any
 * request that would leave this site is refused before it is sent. This is a
 * second line of defence: demo builds also have no backend URL or session.
 */
export class DemoNetworkBlocked extends Error {
  constructor(url: string) { super(`Demo mode: blocked request to ${url}`); this.name = "DemoNetworkBlocked"; }
}

export function isDemoAllowedUrl(input: string, origin: string): boolean {
  try {
    const url = new URL(input, origin);
    return url.origin === origin || url.protocol === "data:" || url.protocol === "blob:";
  } catch { return false; }
}

export function installDemoNetworkGuard(target: Window & typeof globalThis = window): void {
  const origin = target.location.origin;
  const nativeFetch = target.fetch.bind(target);
  target.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!isDemoAllowedUrl(url, origin)) return Promise.reject(new DemoNetworkBlocked(url));
    return nativeFetch(input, init);
  };
  const open = target.XMLHttpRequest.prototype.open;
  target.XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    const href = String(url);
    if (!isDemoAllowedUrl(href, origin)) throw new DemoNetworkBlocked(href);
    return (open as (...args: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof open;
  if (target.navigator.sendBeacon) {
    const beacon = target.navigator.sendBeacon.bind(target.navigator);
    target.navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => isDemoAllowedUrl(String(url), origin) && beacon(url, data);
  }
}
