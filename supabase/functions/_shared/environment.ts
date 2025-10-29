/**
 * Environment detection utility for edge functions
 * Determines if we're running in development/preview or production
 */

export type Environment = 'development' | 'production';

/**
 * Detect the current environment based on the request origin
 * Development includes: localhost, lovableproject.com preview URLs
 * Production: bloomsuite.app and custom domains
 */
export function detectEnvironment(req: Request): Environment {
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  
  // Check if request is from development/preview environment
  const isDev = 
    origin.includes('localhost') ||
    origin.includes('lovableproject.com') ||
    origin.includes('lovable.app') || // Lovable preview URLs
    referer.includes('localhost') ||
    referer.includes('lovableproject.com') ||
    referer.includes('lovable.app');
  
  return isDev ? 'development' : 'production';
}

/**
 * Get environment-specific secret value
 * Looks for DEV or PROD suffix based on environment
 */
export function getEnvSecret(baseName: string, env: Environment): string | undefined {
  const suffix = env === 'development' ? '_DEV' : '_PROD';
  return Deno.env.get(`${baseName}${suffix}`);
}

/**
 * Get Lightspeed credentials for the current environment
 */
export function getLightspeedCredentials(env: Environment): {
  clientId: string | undefined;
  clientSecret: string | undefined;
} {
  return {
    clientId: getEnvSecret('LIGHTSPEED_CLIENT_ID', env),
    clientSecret: getEnvSecret('LIGHTSPEED_CLIENT_SECRET', env),
  };
}
