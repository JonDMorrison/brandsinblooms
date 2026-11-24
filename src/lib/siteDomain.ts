export interface SiteDomainRow {
  domain: string;
  type: string | null;
  status: string | null;
  verified_at: string | null;
  is_primary?: boolean | null;
}

/**
 * The BloomSites custom domain to show for a connected website: only a custom
 * domain that is active and verified (public.domains). Primary wins, then the
 * most recently verified. Anything else (pending DNS, unverified) is hidden
 * and the site's bloomsites.app address is shown instead.
 */
export function pickVerifiedSiteDomain(rows: ReadonlyArray<SiteDomainRow>): string | null {
  const verified = rows.filter(
    (row) =>
      (row.type ?? "custom") === "custom" &&
      row.status === "active" &&
      Boolean(row.verified_at) &&
      row.domain.trim().length > 0,
  );
  verified.sort(
    (a, b) =>
      Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) ||
      String(b.verified_at).localeCompare(String(a.verified_at)),
  );
  return verified[0]?.domain.trim().toLowerCase() ?? null;
}
