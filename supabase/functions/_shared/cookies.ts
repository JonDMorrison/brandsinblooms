/**
 * Cookie utilities for Deno Edge Functions
 * Provides HttpOnly cookie management for secure OAuth state
 */

export const LS_STATE_COOKIE = 'ls_oauth_state';
export const LS_PREFIX_COOKIE = 'ls_domain_prefix';
export const LS_STATE_TTL_SEC = 20 * 60; // 20 minutes

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  maxAge?: number;
  path?: string;
}

/**
 * Set a cookie in the response headers
 */
export function setCookie(
  headers: Headers,
  name: string,
  value: string,
  options: CookieOptions = {}
): void {
  const {
    httpOnly = true,
    secure = true,
    sameSite = 'Lax',
    maxAge = LS_STATE_TTL_SEC,
    path = '/',
  } = options;

  let cookie = `${name}=${value}`;
  if (maxAge) cookie += `; Max-Age=${maxAge}`;
  if (path) cookie += `; Path=${path}`;
  if (httpOnly) cookie += '; HttpOnly';
  if (secure) cookie += '; Secure';
  if (sameSite) cookie += `; SameSite=${sameSite}`;

  headers.append('Set-Cookie', cookie);
}

/**
 * Clear a cookie by setting it to expire immediately
 */
export function clearCookie(
  headers: Headers,
  name: string,
  path: string = '/'
): void {
  const cookie = `${name}=; Max-Age=0; Path=${path}; HttpOnly; Secure; SameSite=Lax`;
  headers.append('Set-Cookie', cookie);
}

/**
 * Get a cookie value from request headers
 */
export function getCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('Cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.split('=');
    if (cookieName === name) {
      return cookieValue;
    }
  }
  return null;
}

/**
 * Generate a secure random state token
 */
export function generateState(length: number = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate domain prefix format
 */
export function isValidPrefix(s: string): boolean {
  return /^[a-z0-9-]+$/i.test(s || '') && s.length >= 3 && s.length <= 50;
}
