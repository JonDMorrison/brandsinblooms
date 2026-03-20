// IMPROVEMENT: Shared helper to proactively refresh Constant Contact token if near expiry
import { decryptToken, encryptToken } from './crypto/tokens.ts';

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Checks if the Constant Contact token is within 5 minutes of expiry.
 * If so, refreshes it and returns the new decrypted access token.
 * Otherwise, decrypts and returns the current token.
 */
export async function getValidCCAccessToken(
  supabase: any,
  connection: {
    id: string;
    encrypted_access_token: string;
    encrypted_refresh_token?: string | null;
    token_expires_at?: string | null;
  }
): Promise<string> {
  const isNearExpiry = connection.token_expires_at &&
    new Date(connection.token_expires_at).getTime() - Date.now() < TOKEN_EXPIRY_BUFFER_MS;

  if (isNearExpiry && connection.encrypted_refresh_token) {
    console.log('[ccTokenRefresh] Token near expiry, proactively refreshing');

    const clientId = Deno.env.get('CONSTANT_CONTACT_CLIENT_ID');
    const clientSecret = Deno.env.get('CONSTANT_CONTACT_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      console.warn('[ccTokenRefresh] Missing OAuth credentials, falling back to current token');
      return await decryptToken(connection.encrypted_access_token);
    }

    let refreshToken: string;
    try {
      refreshToken = await decryptToken(connection.encrypted_refresh_token!);
    } catch {
      console.warn('[ccTokenRefresh] Failed to decrypt refresh token, falling back to current token');
      return await decryptToken(connection.encrypted_access_token);
    }

    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const response = await fetch('https://authz.constantcontact.com/oauth2/default/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (response.ok) {
      const tokenData = await response.json();
      if (tokenData.access_token) {
        const encryptedAccessToken = await encryptToken(tokenData.access_token);
        const updatePayload: any = {
          encrypted_access_token: encryptedAccessToken,
          token_expires_at: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
            : null
        };
        if (tokenData.refresh_token) {
          updatePayload.encrypted_refresh_token = await encryptToken(tokenData.refresh_token);
        }
        await supabase
          .from('provider_connections')
          .update(updatePayload)
          .eq('id', connection.id);
        console.log('[ccTokenRefresh] Token refreshed proactively');
        return tokenData.access_token;
      }
    }

    console.warn('[ccTokenRefresh] Proactive refresh failed, falling back to current token');
  }

  return await decryptToken(connection.encrypted_access_token);
}
