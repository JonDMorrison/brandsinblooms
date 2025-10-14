/**
 * Shared token encryption/decryption utilities using AES-GCM
 * 
 * Key format: Base64-encoded 32-byte key (TOKEN_ENCRYPTION_KEY env var)
 * Output format: base64(iv):base64(ciphertext+authTag)
 * 
 * Rotation notes:
 * - When rotating keys, encrypt new tokens with new key
 * - Keep old key available until all tokens are re-encrypted
 * - Never log decrypted tokens
 */

const TOKEN_ENCRYPTION_KEY_ENV = 'TOKEN_ENCRYPTION_KEY';

/**
 * Get and validate the encryption key from environment
 */
function getEncryptionKey(): string {
  const key = Deno.env.get(TOKEN_ENCRYPTION_KEY_ENV);
  if (!key) {
    throw new Error(`${TOKEN_ENCRYPTION_KEY_ENV} not configured. Please add it to Supabase Edge Function secrets.`);
  }
  return key;
}

/**
 * Import the Base64 key as a CryptoKey for AES-GCM operations
 */
async function importKey(base64Key: string, operation: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  try {
    // Decode Base64 key
    const keyData = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    
    if (keyData.length !== 32) {
      throw new Error('Encryption key must be exactly 32 bytes (256 bits)');
    }

    return await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      [operation]
    );
  } catch (error: any) {
    throw new Error(`Failed to import encryption key: ${error.message}`);
  }
}

/**
 * Encrypt a plaintext token using AES-GCM
 * 
 * @param plaintext - The plaintext token to encrypt
 * @param base64Key - Optional Base64-encoded key (defaults to TOKEN_ENCRYPTION_KEY env var)
 * @returns Base64-encoded encrypted blob in format: base64(iv):base64(ciphertext+authTag)
 */
export async function encryptToken(plaintext: string, base64Key?: string): Promise<string> {
  const key = base64Key || getEncryptionKey();
  const cryptoKey = await importKey(key, 'encrypt');
  
  // Generate random 12-byte IV (recommended for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the plaintext
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  
  // Convert to Base64 and return as iv:ciphertext
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ciphertextB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  
  return `${ivB64}:${ciphertextB64}`;
}

/**
 * Decrypt an encrypted token blob using AES-GCM
 * 
 * @param encryptedBlob - The encrypted blob in format: base64(iv):base64(ciphertext+authTag)
 * @param base64Key - Optional Base64-encoded key (defaults to TOKEN_ENCRYPTION_KEY env var)
 * @returns The decrypted plaintext token
 */
export async function decryptToken(encryptedBlob: string, base64Key?: string): Promise<string> {
  const key = base64Key || getEncryptionKey();
  const cryptoKey = await importKey(key, 'decrypt');
  
  // Split and decode the blob
  const parts = encryptedBlob.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted token format. Expected format: base64(iv):base64(ciphertext)');
  }
  
  const [ivB64, ciphertextB64] = parts;
  
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
  
  if (iv.length !== 12) {
    throw new Error('Invalid IV length. Expected 12 bytes.');
  }
  
  // Decrypt
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error: any) {
    throw new Error(`Decryption failed: ${error.message}. Token may be corrupted or key mismatch.`);
  }
}

/**
 * Validate that the encryption key is properly configured
 * Use this at the start of edge functions to fail fast
 */
export function assertEncryptionKeyConfigured(): void {
  getEncryptionKey(); // Will throw if not configured
}
