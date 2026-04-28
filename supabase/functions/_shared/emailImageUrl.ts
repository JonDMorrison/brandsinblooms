const SUPABASE_URL_FALLBACK = "https://udldmkqwnxhdeztyqcau.supabase.co";

function getSupabaseUrlBase() {
  const envUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const base =
    envUrl && /^https?:\/\//i.test(envUrl) ? envUrl : SUPABASE_URL_FALLBACK;
  return base.replace(/\/$/, "");
}

function isLocalHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost")
  );
}

function parseAsUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isBlockedScheme(value: string) {
  return /^(data:|blob:|file:|cid:|javascript:)/i.test(value);
}

function tryNormalizeSupabaseSignedPath(raw: string): string | null {
  const signedPathMatch = raw.match(
    /^https?:\/\/[^/]+\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(\?.*)?$/i,
  );
  if (signedPathMatch) {
    const bucket = signedPathMatch[1];
    const path = signedPathMatch[2];
    return `${getSupabaseUrlBase()}/storage/v1/object/public/${bucket}/${path}`;
  }

  const relativeSignedMatch = raw.match(
    /^\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(\?.*)?$/i,
  );
  if (relativeSignedMatch) {
    const bucket = relativeSignedMatch[1];
    const path = relativeSignedMatch[2];
    return `${getSupabaseUrlBase()}/storage/v1/object/public/${bucket}/${path}`;
  }

  return null;
}

export function resolveImageSrcToHttps(
  src: string | null | undefined,
): string | null {
  if (!src || typeof src !== "string") {
    return null;
  }

  const trimmed = src.trim();
  if (!trimmed) {
    return null;
  }

  if (isBlockedScheme(trimmed)) {
    return null;
  }

  const signedNormalized = tryNormalizeSupabaseSignedPath(trimmed);
  if (signedNormalized) {
    return signedNormalized;
  }

  if (/^\/\/[^/]+/.test(trimmed)) {
    const protocolRelative = `https:${trimmed}`;
    const protocolRelativeUrl = parseAsUrl(protocolRelative);
    if (!protocolRelativeUrl || isLocalHost(protocolRelativeUrl.hostname)) {
      return null;
    }
    return protocolRelative;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const parsed = parseAsUrl(trimmed);
    if (!parsed || isLocalHost(parsed.hostname)) {
      return null;
    }

    if (parsed.protocol === "http:") {
      parsed.protocol = "https:";
      return parsed.toString();
    }

    if (parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  }

  if (/^[a-z0-9-]+\.supabase\.(co|in)\//i.test(trimmed)) {
    return resolveImageSrcToHttps(`https://${trimmed}`);
  }

  if (/^\/?storage\/v1\/object\/public\//i.test(trimmed)) {
    const normalizedPath = trimmed.replace(/^\/?/, "");
    return `${getSupabaseUrlBase()}/${normalizedPath}`;
  }

  if (/^\//.test(trimmed)) {
    return null;
  }

  if (/^[a-z0-9-]+\/.+\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(trimmed)) {
    return `${getSupabaseUrlBase()}/storage/v1/object/public/${trimmed}`;
  }

  return null;
}

export interface EmailImageWarning {
  index: number;
  originalSrc: string;
  resolvedSrc?: string;
  reason: string;
  action: "resolved" | "removed";
}

export function sanitizeEmailHtmlImageSources(
  html: string,
  context = "email-render",
): { html: string; warnings: EmailImageWarning[] } {
  if (!html || typeof html !== "string") {
    return { html: html || "", warnings: [] };
  }

  const warnings: EmailImageWarning[] = [];
  let imageIndex = 0;

  const sanitizedHtml = html.replace(/<img\b[^>]*>/gi, (tag) => {
    imageIndex += 1;

    const srcMatch = tag.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!srcMatch) {
      warnings.push({
        index: imageIndex,
        originalSrc: "",
        reason: "missing-src-attribute",
        action: "removed",
      });
      return "";
    }

    const rawSrc = (srcMatch[2] ?? srcMatch[3] ?? srcMatch[4] ?? "").trim();
    const resolved = resolveImageSrcToHttps(rawSrc);
    if (!resolved) {
      warnings.push({
        index: imageIndex,
        originalSrc: rawSrc,
        reason: "unresolvable-or-unsafe-src",
        action: "removed",
      });
      return "";
    }

    if (resolved !== rawSrc) {
      warnings.push({
        index: imageIndex,
        originalSrc: rawSrc,
        resolvedSrc: resolved,
        reason: "normalized-src",
        action: "resolved",
      });
      return tag.replace(srcMatch[0], `src="${resolved}"`);
    }

    return tag;
  });

  if (warnings.length > 0) {
    console.warn(
      `[${context}] image-src-sanitizer adjusted ${warnings.length} image(s): ${JSON.stringify(warnings)}`,
    );
  }

  return {
    html: sanitizedHtml,
    warnings,
  };
}
