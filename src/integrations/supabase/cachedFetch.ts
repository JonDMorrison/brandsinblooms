/**
 * Supabase fetch wrapper that prevents "body stream already read" errors.
 *
 * Some upstream/proxy error responses (HTML/text instead of JSON) can trigger
 * a bug pattern where a consumer tries `response.json()` and then falls back
 * to `response.text()` on the same Response, which fails because the stream
 * has already been consumed.
 *
 * We cache the body text for non-OK responses via `response.clone().text()` and
 * override `response.text()` / `response.json()` to serve from the cached copy.
 * This preserves normal behavior for successful responses and makes error
 * parsing resilient.
 */

export const cachedSupabaseFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);

  // Only patch error responses; keep success path fast.
  if (response.ok) return response;

  // If the body is already used for some reason, do not attempt to clone.
  if (response.bodyUsed) return response;

  try {
    const cachedTextPromise = response.clone().text();

    const patchedResponse = response as Response & {
      __cachedTextPromise?: Promise<string>;
    };

    patchedResponse.__cachedTextPromise = cachedTextPromise;

    // Override to make multiple reads safe.
    patchedResponse.text = async () => {
      return await cachedTextPromise;
    };

    patchedResponse.json = async () => {
      const text = await cachedTextPromise;
      return JSON.parse(text);
    };
  } catch {
    // If cloning fails, fall back to the original Response.
  }

  return response;
};
