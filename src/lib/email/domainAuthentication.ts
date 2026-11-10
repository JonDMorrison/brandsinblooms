export interface DomainAuthenticationEvidence {
  dkim_verified?: boolean | null;
  spf_verified?: boolean | null;
  return_path_verified?: boolean | null;
  dmarc_verified?: boolean | null;
}

const AUTHENTICATION_CHECKS = [
  ["SPF", "spf_verified"],
  ["DKIM", "dkim_verified"],
  ["return-path", "return_path_verified"],
  ["DMARC", "dmarc_verified"],
] as const;

export function assessDomainAuthentication(
  evidence: DomainAuthenticationEvidence | null | undefined,
) {
  const missing = AUTHENTICATION_CHECKS.filter(
    ([, field]) => evidence?.[field] !== true,
  ).map(([label]) => label);

  return {
    ready: missing.length === 0,
    missing,
    message:
      missing.length === 0
        ? "SPF, DKIM, return-path, and DMARC are verified."
        : `Authentication incomplete: ${missing.join(", ")}.`,
  };
}
