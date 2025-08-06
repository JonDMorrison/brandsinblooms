/**
 * Production Security Utilities
 * Replaces dangerous HTML rendering with secure alternatives
 */

import { SafeHtml } from '@/components/ui/safe-html';

// Remove all console logging in production
export const removeConsoleLogging = () => {
  if (process.env.NODE_ENV === 'production') {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.info = () => {};
    console.debug = () => {};
  }
};

// Security headers for production - cleaned up legacy tokens
export const getSecurityHeaders = () => ({
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
});

// Validate user input for XSS prevention
export const sanitizeUserInput = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Rate limiting for API calls
export const createRateLimiter = (maxRequests: number, windowMs: number) => {
  const requests = new Map();
  
  return (identifier: string): boolean => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    for (const [key, timestamps] of requests.entries()) {
      const filtered = timestamps.filter((time: number) => time > windowStart);
      if (filtered.length === 0) {
        requests.delete(key);
      } else {
        requests.set(key, filtered);
      }
    }
    
    // Check current requests
    const userRequests = requests.get(identifier) || [];
    const recentRequests = userRequests.filter((time: number) => time > windowStart);
    
    if (recentRequests.length >= maxRequests) {
      return false; // Rate limit exceeded
    }
    
    // Add current request
    recentRequests.push(now);
    requests.set(identifier, recentRequests);
    
    return true; // Request allowed
  };
};

// Error boundary wrapper for production
export const withErrorBoundary = (Component: any) => {
  return (props: any) => {
    try {
      return Component(props);
    } catch (error) {
      // Log error to monitoring service in production
      if (process.env.NODE_ENV === 'production') {
        // Send to error monitoring service
      }
      return 'Something went wrong. Please refresh the page.';
    }
  };
};