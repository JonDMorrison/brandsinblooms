import * as Sentry from "@sentry/react";

export const initSentry = () => {
  // TODO: Replace with your actual Sentry DSN from https://sentry.io
  const dsn = ""; // Add your Sentry DSN here
  
  if (!dsn) {
    console.warn('🟡 Sentry DSN not configured - error tracking disabled');
    return;
  }
  
  console.log('🔧 Initializing Sentry with DSN configured');
  
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'development',
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    // Set sample rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,
    beforeSend(event) {
      // Filter out network errors and other non-critical errors in production
      if (import.meta.env.MODE === 'production') {
        if (event.exception?.values?.[0]?.value?.includes('Failed to fetch')) {
          return null;
        }
        if (event.exception?.values?.[0]?.value?.includes('Network Error')) {
          return null;
        }
      }
      return event;
    },
  });
};

export { Sentry };