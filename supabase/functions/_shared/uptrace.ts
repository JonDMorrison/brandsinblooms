/**
 * Uptrace/OpenTelemetry Integration for Deno Edge Functions
 * https://uptrace.dev/get/instrument/opentelemetry-deno.html
 */

import { OTLPTraceExporter } from "https://esm.sh/@opentelemetry/exporter-trace-otlp-http@0.52.0";
import { Resource } from "https://esm.sh/@opentelemetry/resources@1.25.0";
import { BatchSpanProcessor } from "https://esm.sh/@opentelemetry/sdk-trace-base@1.25.0";
import { NodeTracerProvider } from "https://esm.sh/@opentelemetry/sdk-trace-node@1.25.0";
import { SEMRESATTRS_SERVICE_NAME } from "https://esm.sh/@opentelemetry/semantic-conventions@1.25.0";
import * as api from "https://esm.sh/@opentelemetry/api@1.9.0";

let provider: NodeTracerProvider | null = null;
let tracer: api.Tracer | null = null;

/**
 * Initialize Uptrace tracing for edge functions
 * Must be called once at the start of each edge function
 */
export function initUptrace(serviceName: string) {
  if (provider) return; // Already initialized

  const uptraceUrl = Deno.env.get("UPTRACE_DSN");
  
  if (!uptraceUrl) {
    console.warn("UPTRACE_DSN not configured, telemetry disabled");
    return;
  }

  try {
    // Parse DSN to extract endpoint
    // Format: https://PROJECT_KEY@traces.feuzion.com/PROJECT_ID
    const [credentials, rest] = uptraceUrl.replace("https://", "").split("@");
    const [host, projectPath] = rest.split("/");
    const endpoint = `https://${host}/api/v1/traces`;

    // Configure exporter with Uptrace endpoint
    const exporter = new OTLPTraceExporter({
      url: endpoint,
      headers: {
        "uptrace-dsn": uptraceUrl,
      },
    });

    // Configure resource with service information
    const resource = new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      "deployment.environment": Deno.env.get("ENV") || "production",
    });

    // Create and configure tracer provider
    provider = new NodeTracerProvider({ resource });
    provider.addSpanProcessor(new BatchSpanProcessor(exporter));
    provider.register();

    // Get tracer instance
    tracer = api.trace.getTracer(serviceName);

    console.log(`Uptrace initialized for ${serviceName}`);
  } catch (error) {
    console.error("Failed to initialize Uptrace:", error);
  }
}

/**
 * Start a new span for tracing
 */
export function startSpan(name: string, attributes?: Record<string, any>): api.Span | null {
  if (!tracer) return null;

  const span = tracer.startSpan(name, {
    attributes: attributes || {},
  });

  return span;
}

/**
 * End a span
 */
export function endSpan(span: api.Span | null) {
  if (span) {
    span.end();
  }
}

/**
 * Capture an exception and send to Uptrace
 */
export function captureException(error: any, context?: Record<string, any>) {
  console.error("Exception captured:", error);

  if (!tracer) {
    console.warn("Uptrace not initialized, exception not traced");
    return;
  }

  const span = tracer.startSpan("exception", {
    attributes: {
      "error.type": error?.constructor?.name || "Error",
      "error.message": error?.message || String(error),
      "error.stack": error?.stack || "",
      ...context,
    },
  });

  span.recordException(error);
  span.setStatus({ code: api.SpanStatusCode.ERROR });
  span.end();
}

/**
 * Capture a message (warning, info, etc.) and send to Uptrace
 */
export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context?: Record<string, any>
) {
  console.log(`[${level.toUpperCase()}] ${message}`, context || {});

  if (!tracer) {
    console.warn("Uptrace not initialized, message not traced");
    return;
  }

  const span = tracer.startSpan(`message.${level}`, {
    attributes: {
      "message.content": message,
      "message.level": level,
      ...context,
    },
  });

  span.end();
}

/**
 * Soft fail utility for non-critical issues
 */
export function softFail(code: string, context: Record<string, unknown> = {}) {
  captureMessage(`[soft-fail] ${code}`, "warning", context);
}

/**
 * Shutdown Uptrace provider (call on function exit if needed)
 */
export async function shutdownUptrace() {
  if (provider) {
    await provider.shutdown();
    provider = null;
    tracer = null;
  }
}
