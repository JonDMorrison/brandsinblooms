/**
 * State token utilities for OAuth flows
 * Uses HMAC-SHA256 to sign and verify state tokens containing user data
 */

const encoder = new TextEncoder();

interface StatePayload {
  userId: string;
  tenantId: string;
  domainPrefix: string;
  timestamp: number;
}

/**
 * Generate HMAC signature for data
 */
async function generateSignature(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create a signed state token with user/tenant info
 */
export async function createSignedState(payload: StatePayload): Promise<string> {
  const secret = Deno.env.get('STATE_SIGNING_SECRET');
  if (!secret) {
    throw new Error('STATE_SIGNING_SECRET not configured');
  }
  
  // Add timestamp for expiry validation
  payload.timestamp = Date.now();
  
  // Encode payload as base64
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = btoa(payloadJson);
  
  // Sign the payload
  const signature = await generateSignature(payloadB64, secret);
  
  // Combine payload and signature
  return `${payloadB64}.${signature}`;
}

/**
 * Verify and decode a signed state token
 */
export async function verifySignedState(token: string): Promise<StatePayload> {
  const secret = Deno.env.get('STATE_SIGNING_SECRET');
  if (!secret) {
    throw new Error('STATE_SIGNING_SECRET not configured');
  }
  
  // Split token
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid state token format');
  }
  
  const [payloadB64, providedSignature] = parts;
  
  // Verify signature
  const expectedSignature = await generateSignature(payloadB64, secret);
  if (providedSignature !== expectedSignature) {
    throw new Error('Invalid state token signature');
  }
  
  // Decode payload
  const payloadJson = atob(payloadB64);
  const payload = JSON.parse(payloadJson) as StatePayload;
  
  // Check expiry (30 minutes)
  const maxAge = 30 * 60 * 1000; // 30 minutes
  if (Date.now() - payload.timestamp > maxAge) {
    throw new Error('State token expired');
  }
  
  return payload;
}
