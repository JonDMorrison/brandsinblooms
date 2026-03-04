export type GovernanceRiskLevel = "green" | "yellow" | "orange" | "red";

export type ReputationTier =
  | "normal"
  | "throttled"
  | "restricted"
  | "critical"
  | (string & {});

export type ReputationAction =
  | "allow"
  | "throttle"
  | "restrict"
  | "block"
  | (string & {});

export function governanceRiskFromPolicy(input: {
  reputationTier?: ReputationTier | null;
  reputationAction?: ReputationAction | null;
  hasHardStopThreshold?: boolean;
}): GovernanceRiskLevel {
  if (input.hasHardStopThreshold) return "red";

  const tier = (input.reputationTier || "").toLowerCase();
  const action = (input.reputationAction || "").toLowerCase();

  if (tier === "critical" || action === "block") return "red";
  if (tier === "restricted" || action === "restrict") return "orange";
  if (tier === "throttled" || action === "throttle") return "yellow";
  return "green";
}

export function governanceRiskLabel(level: GovernanceRiskLevel): string {
  switch (level) {
    case "green":
      return "Healthy";
    case "yellow":
      return "Elevated Risk";
    case "orange":
      return "High Risk";
    case "red":
      return "Sending Paused";
  }
}

export function governanceSendingStatusLabel(level: GovernanceRiskLevel): string {
  switch (level) {
    case "green":
      return "Normal";
    case "yellow":
      return "Throttled Automatically";
    case "orange":
      return "Restricted";
    case "red":
      return "Paused";
  }
}

export function governanceRiskBadgeVariant(level: GovernanceRiskLevel) {
  switch (level) {
    case "green":
      return "govHealthy" as const;
    case "yellow":
      return "govElevated" as const;
    case "orange":
      return "govHigh" as const;
    case "red":
      return "govCritical" as const;
  }
}
