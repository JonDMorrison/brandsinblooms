/**
 * Simple Uptrace HTTP Client
 * Sends traces and errors directly to Uptrace via HTTP (no OpenTelemetry SDK)
 */

interface UptraceConfig {
  token: string;
  endpoint: string;
}

interface SpanData {
  name: string;
  startTime: number;
  endTime: number;
  status: 'ok' | 'error';
  attributes?: Record<string, string | number | boolean>;
  error?: {
    message: string;
    stack?: string;
  };
}

let config: UptraceConfig | null = null;

/**
 * Initialize Uptrace from DSN environment variable
 * DSN format: https://<token>@<host>
 */
function initUptrace(): UptraceConfig | null {
  if (config) return config;

  const dsn = Deno.env.get('UPTRACE_DSN');
  if (!dsn) {
    console.warn('[Uptrace] UPTRACE_DSN not configured');
    return null;
  }

  try {
    // Parse DSN: https://token@host
    const url = new URL(dsn);
    const token = url.username;
    const endpoint = `${url.protocol}//${url.host}`;

    if (!token) {
      console.error('[Uptrace] Invalid DSN: missing token');
      return null;
    }

    config = { token, endpoint };
    console.log('[Uptrace] Initialized:', { endpoint });
    return config;
  } catch (error) {
    console.error('[Uptrace] Failed to parse DSN:', error.message);
    return null;
  }
}

/**
 * Send trace data to Uptrace
 */
async function sendTrace(span: SpanData): Promise<void> {
  const cfg = initUptrace();
  if (!cfg) return;

  try {
    // Create OTLP-like trace data
    const traceData = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'bloomsuite-edge-functions' } },
            { key: 'deployment.environment', value: { stringValue: 'production' } },
          ],
        },
        scopeSpans: [{
          scope: { name: 'manual-instrumentation', version: '1.0.0' },
          spans: [{
            traceId: generateTraceId(),
            spanId: generateSpanId(),
            name: span.name,
            kind: 1, // SPAN_KIND_INTERNAL
            startTimeUnixNano: span.startTime * 1_000_000,
            endTimeUnixNano: span.endTime * 1_000_000,
            attributes: Object.entries(span.attributes || {}).map(([key, value]) => ({
              key,
              value: typeof value === 'string' 
                ? { stringValue: value }
                : typeof value === 'number'
                ? { intValue: value }
                : { boolValue: value }
            })),
            status: {
              code: span.status === 'ok' ? 1 : 2, // 1=OK, 2=ERROR
              message: span.error?.message || '',
            },
            ...(span.error && {
              events: [{
                timeUnixNano: span.endTime * 1_000_000,
                name: 'exception',
                attributes: [
                  { key: 'exception.message', value: { stringValue: span.error.message } },
                  ...(span.error.stack ? [{ 
                    key: 'exception.stacktrace', 
                    value: { stringValue: span.error.stack } 
                  }] : []),
                ],
              }],
            }),
          }],
        }],
      }],
    };

    // Send to Uptrace OTLP endpoint
    const response = await fetch(`${cfg.endpoint}/v1/traces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'uptrace-dsn': cfg.token,
      },
      body: JSON.stringify(traceData),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[Uptrace] Failed to send trace:', response.status, text);
    }
  } catch (error) {
    console.error('[Uptrace] Error sending trace:', error.message);
  }
}

/**
 * Generate a random trace ID (32 hex characters)
 */
function generateTraceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random span ID (16 hex characters)
 */
function generateSpanId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Execute a function and track it as a span
 */
export async function withTrace<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const startTime = Date.now();
  console.log(`[Trace] Starting: ${name}`);

  try {
    const result = await fn();
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`[Trace] Success: ${name} (${duration}ms)`);

    // Send success trace
    await sendTrace({
      name,
      startTime,
      endTime,
      status: 'ok',
      attributes: {
        ...attributes,
        'duration.ms': duration,
      },
    });

    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.error(`[Trace] Error: ${name} (${duration}ms):`, error.message);

    // Send error trace
    await sendTrace({
      name,
      startTime,
      endTime,
      status: 'error',
      attributes: {
        ...attributes,
        'duration.ms': duration,
      },
      error: {
        message: error.message,
        stack: error.stack,
      },
    });

    throw error;
  }
}

/**
 * Log an error to Uptrace
 */
export async function logError(
  operation: string,
  error: Error,
  context?: Record<string, string | number | boolean>
): Promise<void> {
  const now = Date.now();
  console.error(`[Error] ${operation}:`, error.message);

  await sendTrace({
    name: `error.${operation}`,
    startTime: now,
    endTime: now,
    status: 'error',
    attributes: context,
    error: {
      message: error.message,
      stack: error.stack,
    },
  });
}
