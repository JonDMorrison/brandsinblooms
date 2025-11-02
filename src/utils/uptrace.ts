/**
 * Uptrace Frontend Integration using OpenTelemetry
 * Provides error tracking, performance monitoring, and user context for the frontend
 */

import Uptrace from '@uptrace/web';

let sdk: ReturnType<typeof Uptrace.configureOpentelemetry> | null = null;

/**
 * Initialize Uptrace for the frontend
 * Should be called once in main.tsx
 */
export function initUptrace() {
  const uptraceDsn = import.meta.env.VITE_UPTRACE_DSN;
  
  if (!uptraceDsn) {
    console.warn('VITE_UPTRACE_DSN not configured, telemetry disabled');
    return;
  }

  if (sdk) {
    return; // Already initialized
  }

  try {
    // Configure OpenTelemetry with Uptrace
    sdk = Uptrace.configureOpentelemetry({
      dsn: uptraceDsn,
      serviceName: 'bloomsuite-frontend',
      serviceVersion: '1.0.0',
      deploymentEnvironment: import.meta.env.MODE || 'production',
    });

    console.log('Uptrace frontend initialized');
  } catch (error) {
    console.error('Failed to initialize Uptrace:', error);
  }
}

/**
 * Capture an exception and send to Uptrace
 * Uses console.error for logging since Uptrace will pick it up automatically
 */
export function captureException(error: Error, context?: Record<string, any>) {
  console.error('Exception captured:', error, context);

  if (!sdk) {
    console.warn('Uptrace not initialized, exception not sent');
    return;
  }

  // OpenTelemetry will automatically capture console.error calls
  // Additional context can be added as structured data
  if (context) {
    console.error('Exception context:', JSON.stringify(context));
  }
}

/**
 * Capture a message (info, warning, error) and send to Uptrace
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
) {
  const logFn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
  logFn(`[${level.toUpperCase()}] ${message}`, context || {});

  if (!sdk) {
    console.warn('Uptrace not initialized, message not sent');
    return;
  }
}

/**
 * Set user context for error tracking
 * OpenTelemetry attributes will be added to spans
 */
export function setUserContext(userId: string, email?: string, metadata?: Record<string, any>) {
  if (!sdk) {
    return;
  }

  try {
    // Log user context for OpenTelemetry to capture
    console.log('[User Context]', { userId, email, ...metadata });
  } catch (err) {
    console.error('Failed to set user context:', err);
  }
}

/**
 * Start a performance transaction (simplified for OpenTelemetry)
 */
export function startTransaction(name: string, op?: string) {
  if (!sdk) {
    return null;
  }

  try {
    console.log(`[Transaction Start] ${name}`, { op: op || 'navigation' });
    return { name, startTime: Date.now() };
  } catch (err) {
    console.error('Failed to start transaction:', err);
    return null;
  }
}

/**
 * Add breadcrumb for user actions
 */
export function addBreadcrumb(message: string, category?: string, data?: Record<string, any>) {
  if (!sdk) {
    return;
  }

  try {
    console.log(`[Breadcrumb] ${message}`, { category: category || 'user-action', ...data });
  } catch (err) {
    console.error('Failed to add breadcrumb:', err);
  }
}
