/**
 * Serve Embed Assets Edge Function
 * 
 * Serves embed.js and embed.css files directly from the edge function.
 * This allows the AI to push changes automatically without manual upload steps.
 * 
 * URLs:
 * - https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/serve-embed-assets?file=embed.v1.js
 * - https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/serve-embed-assets?file=embed.css
 * 
 * When updating embed files:
 * 1. Update the source in public/forms/ (for local dev/preview)
 * 2. Update the EMBED_* constants in this file
 * 3. Changes auto-deploy with the edge function
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// ─── Embed CSS Content ─────────────────────────────────────────────────────
const EMBED_CSS = `/**
 * BloomSuite Forms Embed Stylesheet v1.0.0
 * 
 * Served from same origin as embed.js to avoid CSP issues.
 * All classes prefixed with bs-form- for scoping.
 */

/* ─── Reset & Container ─────────────────────────────────────────────────── */
.bs-form-container {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  color: #1f2937;
  max-width: 100%;
}

.bs-form-container *,
.bs-form-container *::before,
.bs-form-container *::after {
  box-sizing: border-box;
}

/* ─── Form Wrapper ──────────────────────────────────────────────────────── */
.bs-form-wrapper {
  background: #ffffff;
  padding: 0;
}

/* ─── Field Wrapper ─────────────────────────────────────────────────────── */
.bs-form-field {
  margin-bottom: 16px;
}

.bs-form-field:last-of-type {
  margin-bottom: 20px;
}

/* ─── Labels ────────────────────────────────────────────────────────────── */
.bs-form-label {
  display: block;
  font-weight: 500;
  font-size: 14px;
  color: #374151;
  margin-bottom: 6px;
}

.bs-form-required {
  color: #dc2626;
  margin-left: 2px;
}

/* ─── Text Inputs ───────────────────────────────────────────────────────── */
.bs-form-input {
  display: block;
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.5;
  color: #1f2937;
  background-color: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: var(--bs-form-radius, 8px);
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  -webkit-appearance: none;
  appearance: none;
}

.bs-form-input:focus {
  outline: none;
  border-color: var(--bs-form-primary, #22C55E);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
}

.bs-form-input::placeholder {
  color: #9ca3af;
}

.bs-form-input:disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

/* ─── Select ────────────────────────────────────────────────────────────── */
.bs-form-select {
  display: block;
  width: 100%;
  padding: 10px 36px 10px 12px;
  font-size: 14px;
  line-height: 1.5;
  color: #1f2937;
  background-color: #ffffff;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 12px center;
  background-repeat: no-repeat;
  background-size: 16px 12px;
  border: 1px solid #d1d5db;
  border-radius: var(--bs-form-radius, 8px);
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.bs-form-select:focus {
  outline: none;
  border-color: var(--bs-form-primary, #22C55E);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
}

/* ─── Checkbox ──────────────────────────────────────────────────────────── */
.bs-form-checkbox-wrap {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.bs-form-checkbox {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  accent-color: var(--bs-form-primary, #22C55E);
  cursor: pointer;
}

.bs-form-checkbox-text {
  font-size: 14px;
  color: #4b5563;
  line-height: 1.5;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
}

/* ─── Consent Fields ────────────────────────────────────────────────────── */
.bs-form-consent {
  background: #f9fafb;
  padding: 12px;
  border-radius: var(--bs-form-radius, 8px);
  border: 1px solid #e5e7eb;
}

.bs-form-consent .bs-form-checkbox-text {
  font-size: 13px;
  color: #6b7280;
}

/* ─── Submit Button ─────────────────────────────────────────────────────── */
.bs-form-submit {
  display: block;
  width: 100%;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  background-color: var(--bs-form-primary, #22C55E);
  border: none;
  border-radius: var(--bs-form-radius, 8px);
  cursor: pointer;
  transition: background-color 0.15s ease-in-out, transform 0.1s ease-in-out;
  -webkit-appearance: none;
  appearance: none;
}

.bs-form-submit:hover {
  background-color: var(--bs-form-primary-hover, #16a34a);
}

.bs-form-submit:active {
  transform: scale(0.98);
}

.bs-form-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.bs-form-submit-outline {
  background-color: transparent;
  border: 2px solid var(--bs-form-primary, #22C55E);
  color: var(--bs-form-primary, #22C55E);
}

.bs-form-submit-outline:hover {
  background-color: var(--bs-form-primary, #22C55E);
  color: #ffffff;
}

.bs-form-submit-rounded {
  border-radius: 9999px;
}

/* ─── Error States ──────────────────────────────────────────────────────── */
.bs-form-error-msg {
  color: #dc2626;
  font-size: 13px;
  margin-top: 6px;
}

.bs-form-input-error {
  border-color: #dc2626;
}

.bs-form-input-error:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15);
}

/* ─── Success State ─────────────────────────────────────────────────────── */
.bs-form-success {
  text-align: center;
  padding: 32px 24px;
  background: #f0fdf4;
  border-radius: var(--bs-form-radius, 8px);
  border: 1px solid #bbf7d0;
}

.bs-form-success-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  background: #22C55E;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bs-form-success-icon svg {
  width: 28px;
  height: 28px;
  stroke: #ffffff;
  fill: none;
}

.bs-form-success-text {
  font-size: 18px;
  font-weight: 600;
  color: #166534;
  margin: 0;
}

/* ─── Loading State ─────────────────────────────────────────────────────── */
.bs-form-loading {
  text-align: center;
  padding: 48px 24px;
  color: #6b7280;
  font-size: 14px;
}

.bs-form-spinner {
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top-color: var(--bs-form-primary, #22C55E);
  border-radius: 50%;
  animation: bs-form-spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes bs-form-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ─── Branding ──────────────────────────────────────────────────────────── */
.bs-form-branding {
  text-align: center;
  margin-top: 16px;
  font-size: 12px;
  color: #9ca3af;
}

.bs-form-branding a {
  color: #6b7280;
  text-decoration: none;
}

.bs-form-branding a:hover {
  text-decoration: underline;
}

/* ─── Honeypot (hidden from users & screen readers) ─────────────────────── */
.bs-form-hp {
  position: absolute !important;
  left: -9999px !important;
  top: -9999px !important;
  opacity: 0 !important;
  pointer-events: none !important;
  height: 0 !important;
  overflow: hidden !important;
}

/* ─── Blocked/Error Fallback ────────────────────────────────────────────── */
.bs-form-blocked {
  text-align: center;
  padding: 24px;
  background: #fef2f2;
  border-radius: 8px;
  border: 1px solid #fecaca;
  color: #991b1b;
  font-size: 14px;
}

/* ─── Fallback Mode (no external CSS loaded) ────────────────────────────── */
.bs-form-fallback .bs-form-field {
  margin-bottom: 1em;
}

.bs-form-fallback .bs-form-label {
  display: block;
  margin-bottom: 0.25em;
  font-weight: bold;
}

.bs-form-fallback .bs-form-input,
.bs-form-fallback .bs-form-select {
  width: 100%;
  padding: 0.5em;
  border: 1px solid #ccc;
}

.bs-form-fallback .bs-form-submit {
  padding: 0.75em 1.5em;
  background: #22C55E;
  color: white;
  border: none;
  cursor: pointer;
}

.bs-form-fallback .bs-form-checkbox-wrap {
  display: block;
}

.bs-form-fallback .bs-form-consent {
  padding: 0.75em;
  background: #f5f5f5;
  border: 1px solid #ddd;
}

/* ─── Modal Styles ──────────────────────────────────────────────────────── */
.bs-form-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
}

.bs-form-modal-overlay.bs-form-open {
  opacity: 1;
  visibility: visible;
}

.bs-form-modal-content {
  background: #fff;
  border-radius: 12px;
  max-width: 480px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  transform: scale(0.95);
  transition: transform 0.2s;
}

.bs-form-modal-overlay.bs-form-open .bs-form-modal-content {
  transform: scale(1);
}

.bs-form-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
  color: #666;
}

.bs-form-modal-close:hover {
  color: #333;
}

.bs-form-modal-body {
  padding: 24px;
}

/* ─── Slide-in Styles ───────────────────────────────────────────────────── */
.bs-form-slidein-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 9999;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s, visibility 0.3s;
}

.bs-form-slidein-overlay.bs-form-open {
  opacity: 1;
  visibility: visible;
}

.bs-form-slidein-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 400px;
  max-width: 100%;
  background: #fff;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  transform: translateX(100%);
  transition: transform 0.3s ease;
  z-index: 10000;
  overflow-y: auto;
}

.bs-form-slidein-overlay.bs-form-open .bs-form-slidein-panel {
  transform: translateX(0);
}

.bs-form-slidein-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e5e5;
}

.bs-form-slidein-title {
  font-weight: 600;
  font-size: 18px;
  margin: 0;
}

.bs-form-slidein-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 24px;
  color: #666;
}

.bs-form-slidein-close:hover {
  color: #333;
}

.bs-form-slidein-body {
  padding: 20px;
}

/* ─── Trigger Button ────────────────────────────────────────────────────── */
.bs-form-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: #22C55E;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.bs-form-trigger:hover {
  background: #16A34A;
}

/* ─── Debug Panel ───────────────────────────────────────────────────────── */
.bs-form-debug-panel {
  margin-top: 1em;
  padding: 0.75em;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
}

.bs-form-debug-panel dt {
  font-weight: bold;
  color: #0369a1;
}

.bs-form-debug-panel dd {
  margin: 0 0 0.5em 0;
  color: #334155;
  word-break: break-all;
}

/* ─── Error Box ─────────────────────────────────────────────────────────── */
.bs-form-error-box {
  padding: 1em;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #991b1b;
  font-size: 14px;
}

.bs-form-error-box strong {
  display: block;
  margin-bottom: 0.5em;
}

.bs-form-error-box ul {
  margin: 0.5em 0 0;
  padding-left: 1.25em;
}`;

// Supported files and their metadata
const FILE_MAP: Record<string, { content: string; contentType: string; cacheControl: string }> = {
  'embed.css': {
    content: EMBED_CSS,
    contentType: 'text/css; charset=utf-8',
    cacheControl: 'public, max-age=3600, stale-while-revalidate=86400', // 1 hour cache
  },
};

// Note: embed.v1.js is served from a separate file due to size
// Import it from a companion module or inline it here

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const file = url.searchParams.get('file');

    // List available files if no file specified
    if (!file) {
      return new Response(
        JSON.stringify({
          available_files: Object.keys(FILE_MAP),
          usage: '?file=embed.css',
          note: 'For embed.v1.js, use Supabase Storage or the separate edge function',
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Check if file exists
    const fileData = FILE_MAP[file];
    if (!fileData) {
      return new Response(
        JSON.stringify({
          error: 'File not found',
          available_files: Object.keys(FILE_MAP),
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Serve the file
    return new Response(fileData.content, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': fileData.contentType,
        'Cache-Control': fileData.cacheControl,
        'X-Content-Version': '1.0.0',
      },
    });

  } catch (error) {
    console.error('[serve-embed-assets] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
