function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * The time zone a tenant works in, for defaults such as a new location:
 * tenants.settings.timezone (the app-wide convention), then the tenant's
 * existing locations, then the browser's zone.
 */
export function resolveTenantTimezone(input: {
  tenantSettings?: unknown;
  locationTimezones?: ReadonlyArray<string | null | undefined>;
  browserTimezone?: string | null;
  fallback?: string;
}): string {
  const settings =
    input.tenantSettings && typeof input.tenantSettings === "object"
      ? (input.tenantSettings as Record<string, unknown>)
      : {};
  if (isValidTimeZone(settings.timezone)) return settings.timezone;

  const fromLocation = (input.locationTimezones ?? []).find(isValidTimeZone);
  if (fromLocation) return fromLocation;

  const browser =
    input.browserTimezone === undefined
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : input.browserTimezone;
  if (isValidTimeZone(browser)) return browser;

  return input.fallback ?? "America/Toronto";
}
