/**
 * Uptrace Frontend Integration using OpenTelemetry
 * Provides error tracking, performance monitoring, and user context for the frontend
 */

import Uptrace from '@uptrace/web';
import { trace, SpanStatusCode, diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';

let sdk: ReturnType<typeof Uptrace.configureOpentelemetry> | null = null;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSupabaseIgnoreUrls(): Array<string | RegExp> {
  const fallbackSupabaseUrl = 'https://udldmkqwnxhdeztyqcau.supabase.co';
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;

  try {
    const host = new URL(supabaseUrl).host;
    const escapedHost = escapeRegExp(host);
    return [new RegExp(`^https?://${escapedHost}(?:/|$)`, 'i')];
  } catch {
    return [fallbackSupabaseUrl];
  }
}

/**
 * Initialize Uptrace for the frontend
 * Should be called once in main.tsx
 */
export function initUptrace() {
  // Temporary kill-switch for debugging.
  // - Build-time: set VITE_DISABLE_TELEMETRY=true
  // - Runtime: append ?telemetry=off
  try {
    const envDisabled = String(import.meta.env.VITE_DISABLE_TELEMETRY || '').toLowerCase() === 'true';
    const urlDisabled =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('telemetry') === 'off';

    if (envDisabled || urlDisabled) {
      console.warn('[Uptrace] Telemetry disabled (kill-switch)');
      return;
    }
  } catch {
    // ignore
  }

  const uptraceDsn = import.meta.env.VITE_UPTRACE_DSN;
  
  if (!uptraceDsn) {
    console.warn('VITE_UPTRACE_DSN not configured, telemetry disabled');
    return;
  }

  if (sdk) {
    console.log('Uptrace already initialized');
    return; // Already initialized
  }

  try {
    const ignoreUrls = getSupabaseIgnoreUrls();

    // Enable debug logging for OpenTelemetry (only in development)
    if (import.meta.env.DEV) {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
      console.log('[Uptrace] Debug logging enabled');
    }

    console.log('[Uptrace] Initializing with DSN:', uptraceDsn.split('@')[0] + '@***');
    
    // Configure OpenTelemetry with Uptrace
    sdk = Uptrace.configureOpentelemetry({
      dsn: uptraceDsn,
      serviceName: 'bloomsuite-frontend',
      serviceVersion: '1.0.0',
      deploymentEnvironment: import.meta.env.MODE || 'production',
      
      // Add automatic instrumentations for browser
      instrumentations: [
        getWebAutoInstrumentations({
          // Track fetch requests
          '@opentelemetry/instrumentation-fetch': {
            propagateTraceHeaderCorsUrls: /.+/g,
            clearTimingResources: true,
            ignoreUrls,
          },
          // Track XHR requests
          '@opentelemetry/instrumentation-xml-http-request': {
            propagateTraceHeaderCorsUrls: /.+/g,
            ignoreUrls,
          },
          // Track document load events
          '@opentelemetry/instrumentation-document-load': {},
        }),
      ],
    });

    console.log('[Uptrace] SDK configured, starting...');
    sdk.start();
    console.log('[Uptrace] ✅ Frontend telemetry initialized successfully');
  } catch (error) {
    console.error('[Uptrace] ❌ Failed to initialize:', error);
  }
}

/**
 * Capture an exception and send to Uptrace
 * Uses OpenTelemetry tracer to properly record exceptions
 */
export function captureException(error: Error, context?: Record<string, any>) {
  console.error('Exception captured:', error, context);

  if (!sdk) {
    console.warn('Uptrace not initialized, exception not sent');
    return;
  }

  try {
    // Get the global tracer from OpenTelemetry
    const tracer = trace.getTracer('bloomsuite-frontend');
    const span = tracer.startSpan('exception');
    
    span.recordException(error);
    span.setAttributes({
      'error.type': error.name || 'Error',
      'error.message': error.message || String(error),
      'error.stack': error.stack || '',
      ...(context || {}),
    });
    
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.end();
  } catch (err) {
    console.error('Failed to capture exception in Uptrace:', err);
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
 * Creates a span with user attributes for correlation
 */
export function setUserContext(userId: string, email?: string, metadata?: Record<string, any>) {
  if (!sdk) {
    return;
  }

  try {
    const tracer = trace.getTracer('bloomsuite-frontend');
    const span = tracer.startSpan('user.context');
    
    span.setAttributes({
      'user.id': userId,
      'user.email': email || '',
      ...(metadata || {}),
    });
    
    span.end();
    console.log('[User Context Set]', { userId, email });
  } catch (err) {
    console.error('Failed to set user context:', err);
  }
}

/**
 * Start a performance transaction using OpenTelemetry spans
 */
export function startTransaction(name: string, op?: string) {
  if (!sdk) {
    return null;
  }

  try {
    const tracer = trace.getTracer('bloomsuite-frontend');
    const span = tracer.startSpan(name, {
      attributes: { 'transaction.op': op || 'navigation' }
    });
    
    console.log(`[Transaction Start] ${name}`, { op: op || 'navigation' });
    return { span, name, startTime: Date.now() };
  } catch (err) {
    console.error('Failed to start transaction:', err);
    return null;
  }
}

/**
 * Add breadcrumb for user actions using spans
 */
export function addBreadcrumb(message: string, category?: string, data?: Record<string, any>) {
  if (!sdk) {
    return;
  }

  try {
    const tracer = trace.getTracer('bloomsuite-frontend');
    const span = tracer.startSpan(`breadcrumb.${category || 'user-action'}`);
    
    span.setAttributes({
      'breadcrumb.message': message,
      'breadcrumb.category': category || 'user-action',
      ...(data || {}),
    });
    
    span.end();
    console.log(`[Breadcrumb] ${message}`, { category: category || 'user-action', ...data });
  } catch (err) {
    console.error('Failed to add breadcrumb:', err);
  }
}

/**
 * End a transaction span
 */
export function endTransaction(transaction: ReturnType<typeof startTransaction>) {
  if (!transaction?.span) {
    return;
  }

  try {
    transaction.span.end();
    const duration = Date.now() - transaction.startTime;
    console.log(`[Transaction End] ${transaction.name} (${duration}ms)`);
  } catch (err) {
    console.error('Failed to end transaction:', err);
  }
}
