// Minimal Uptrace error logging for edge functions
const UPTRACE_DSN = Deno.env.get('UPTRACE_DSN');

export async function logError(error: any, context: string, metadata?: Record<string, any>) {
  if (!UPTRACE_DSN) {
    console.error('[Uptrace] DSN not configured');
    return;
  }

  try {
    const errorData = {
      timestamp: new Date().toISOString(),
      level: 'error',
      context,
      message: error?.message || String(error),
      stack: error?.stack,
      ...metadata
    };

    await fetch(UPTRACE_DSN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorData)
    });
  } catch (e) {
    console.error('[Uptrace] Failed to log error:', e);
  }
}
