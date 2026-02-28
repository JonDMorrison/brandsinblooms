export function serializeSupabaseError(err: any) {
  if (!err) return null;

  let safeJson: string | null = null;
  try {
    safeJson = JSON.stringify(err);
  } catch {
    safeJson = null;
  }

  const keys = (() => {
    try {
      return typeof err === 'object' && err ? Object.keys(err) : null;
    } catch {
      return null;
    }
  })();

  return {
    type: typeof err,
    isArray: Array.isArray(err),
    keys,
    asString: (() => {
      try {
        return String(err);
      } catch {
        return null;
      }
    })(),
    json: safeJson,
    name: err?.name,
    message: err?.message,
    code: err?.code,
    details: err?.details,
    hint: err?.hint,
    status: err?.status,
    statusCode: err?.statusCode,
  };
}

export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
