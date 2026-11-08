/**
 * System status: turns the /readiness capability list into plain groups and
 * states. Pure: no React, no I/O.
 */

export interface Capability {
  key: string;
  label: string;
  implemented: boolean;
  configured: boolean;
  missing: string[];
  tested: string;
  enabled: boolean | null;
  live: string | null;
  note?: string;
}

export type CapabilityState = "ready" | "needs_setup" | "off" | "not_built";
export type GroupKey = "support" | "automation" | "tools" | "other";

export const GROUP_LABEL: Record<GroupKey, string> = {
  support: "Customer support",
  automation: "Bloom automation",
  tools: "Product tools",
  other: "Other services",
};

const GROUP_OF: Record<string, GroupKey> = {
  desk: "support", intake_crm: "support", intake_cms: "support", intake_pos: "support",
  intake_public: "support", email_in: "support", email_out: "support", knowledge: "support",
  worker: "automation", watchdog: "automation", queue: "automation", ai: "automation",
  repair: "automation", ticket_flow: "automation", release: "automation", rollback: "automation",
  ops_campaigns: "tools", ops_cms: "tools", ops_pos: "tools",
  chatgpt: "other",
};

/** Plain names and one-line purposes. Unknown keys fall back to the server's label. */
const FRIENDLY: Record<string, { name: string; purpose: string }> = {
  desk: { name: "Support desk", purpose: "Requests, replies and decisions in this desk." },
  intake_crm: { name: "Help from the CRM", purpose: "Clients ask for help inside BloomSuite CRM." },
  intake_cms: { name: "Help from BloomSites", purpose: "Clients ask for help inside BloomSites." },
  intake_pos: { name: "Help from the POS", purpose: "Stores ask for help from the till or back office." },
  intake_public: { name: "Contact form", purpose: "People who can't sign in can still reach us." },
  email_in: { name: "Email to Bloom", purpose: "Emails to the support address become requests." },
  email_out: { name: "Email to clients", purpose: "Bloom and the team reply to clients by email." },
  knowledge: { name: "Saved answers", purpose: "Approved answers Bloom can reuse." },
  worker: { name: "Bloom's background work", purpose: "Bloom works through requests on its own schedule." },
  watchdog: { name: "Failure alerts", purpose: "Warns the team when automatic work stops." },
  queue: { name: "Work queue", purpose: "Bloom's list of steps waiting to run." },
  ai: { name: "Bloom's AI model", purpose: "Reads and sorts new requests." },
  repair: { name: "Automatic investigation", purpose: "Bloom investigates bugs and prepares fixes." },
  ticket_flow: { name: "Fix checks", purpose: "Bloom checks the affected page before closing a request." },
  release: { name: "Automatic release", purpose: "Approved, eligible fixes go live without a person." },
  rollback: { name: "Automatic rollback", purpose: "A fix that fails its live check is undone." },
  ops_campaigns: { name: "Campaign changes", purpose: "Look up and change client campaigns, with a preview." },
  ops_cms: { name: "BloomSites changes", purpose: "Look up and change client websites, with a preview." },
  ops_pos: { name: "POS lookups", purpose: "Read store POS information." },
  chatgpt: { name: "ChatGPT connection", purpose: "Team members ask Bloom questions from ChatGPT." },
};

export const friendlyName = (c: Pick<Capability, "key" | "label">) => FRIENDLY[c.key]?.name ?? c.label;
export const purposeOf = (c: Pick<Capability, "key">) => FRIENDLY[c.key]?.purpose ?? null;
export const groupOf = (c: Pick<Capability, "key">): GroupKey => GROUP_OF[c.key] ?? "other";

export function capabilityState(c: Capability): CapabilityState {
  if (!c.implemented) return "not_built";
  if (!c.configured) return "needs_setup";
  if (c.enabled === false) return "off";
  return "ready";
}

export const STATE_LABEL: Record<CapabilityState, string> = {
  ready: "Ready",
  needs_setup: "Needs setup",
  off: "Switched off",
  not_built: "Not built yet",
};

export interface StatusSummary {
  ready: number;
  needsSetup: number;
  observed: number;
  attention: Capability[];
  groups: Array<{ key: GroupKey; label: string; items: Capability[]; ready: number }>;
}

export function summarizeCapabilities(caps: Capability[]): StatusSummary {
  const attention = caps.filter((c) => capabilityState(c) === "needs_setup");
  const order: GroupKey[] = ["support", "automation", "tools", "other"];
  const groups = order
    .map((key) => {
      const items = caps.filter((c) => groupOf(c) === key);
      return { key, label: GROUP_LABEL[key], items, ready: items.filter((c) => capabilityState(c) === "ready").length };
    })
    .filter((g) => g.items.length > 0);
  return {
    ready: caps.filter((c) => capabilityState(c) === "ready").length,
    needsSetup: attention.length,
    observed: caps.filter((c) => !!c.live).length,
    attention,
    groups,
  };
}

/** Bloom's headline state from the readiness summary. */
export function runningState(continuous: string | undefined): { tone: "success" | "warning" | "danger"; title: string; body: string } {
  if (continuous === "running") return { tone: "success", title: "Bloom is running", body: "Bloom's background work checked in within the last 15 minutes." };
  if (continuous === "paused") return { tone: "danger", title: "Bloom is paused", body: "Automatic work is switched off in Settings. Requests wait for a person." };
  return { tone: "warning", title: "Bloom needs attention", body: "Automatic work is switched on, but Bloom's background work hasn't checked in for 15 minutes." };
}
