export type Environment = 'development' | 'production';

/**
 * Detect the current environment based on the window location
 * Development includes: localhost, lovableproject.com, lovable.app
 * Production: bloomsuite.app and custom domains
 */
export function detectEnvironment(): Environment {
  const hostname = window.location.hostname;
  
  const isDev = 
    hostname.includes('localhost') ||
    hostname.includes('lovableproject.com') ||
    hostname.includes('lovable.app');
  
  return isDev ? 'development' : 'production';
}

/**
 * Get environment-aware OAuth redirect URI
 */
export function getOAuthRedirectUri(path: string = '/oauth/callback'): string {
  const env = detectEnvironment();
  const baseUrl = env === 'development'
    ? window.location.origin // Use current preview URL
    : 'https://bloomsuite.app';
  
  return `${baseUrl}${path}`;
}

/**
 * Get a display-friendly name for the current environment
 */
export function getEnvironmentName(): string {
  return detectEnvironment() === 'development' ? 'Development' : 'Production';
}

/**
 * Check if currently in development environment
 */
export function isDevelopment(): boolean {
  return detectEnvironment() === 'development';
}
