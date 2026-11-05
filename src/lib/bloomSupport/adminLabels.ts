// Display wording for the two admin alert inboxes behind the internal
// escalation audiences "jon", "jeff" and "both". The identifiers are data and
// stay as they are; what a person sees is "Admin", plus the name or email of the
// person who holds that inbox, read from the owners setting and the staff list.

export type AdminInboxKey = "jon" | "jeff";
export type AdminAudience = AdminInboxKey | "both";
export type AdminInboxNames = Record<AdminInboxKey, string | null>;

export const ADMIN_INBOX_KEYS: readonly AdminInboxKey[] = ["jon", "jeff"];

interface StaffPerson { id: string; name: string | null; email: string | null }

const INBOX_FALLBACK: Record<AdminInboxKey, string> = { jon: "inbox 1", jeff: "inbox 2" };

const emailsFor = (owners: unknown, key: AdminInboxKey): string[] => {
  if (!owners || typeof owners !== "object") return [];
  const list = (owners as Record<string, unknown>)[key];
  return Array.isArray(list) ? list.filter((e): e is string => typeof e === "string" && e.trim() !== "") : [];
};

/** Who holds each admin inbox: the staff member whose email is configured for it, else the first configured email. */
export function adminInboxNames(owners: unknown, staff: readonly StaffPerson[] | undefined): AdminInboxNames {
  const pick = (key: AdminInboxKey): string | null => {
    const emails = emailsFor(owners, key);
    const lowered = emails.map((e) => e.toLowerCase());
    const person = (staff ?? []).find((p) => p.email && lowered.includes(p.email.toLowerCase()));
    return person?.name?.trim() || person?.email || emails[0] || null;
  };
  return { jon: pick("jon"), jeff: pick("jeff") };
}

/** "All admins" for both inboxes; otherwise "Admin · <name>" when the holder is known, or a neutral inbox label. */
export function adminAudienceLabel(audience: string, names?: Partial<AdminInboxNames>, ownerName?: string | null): string {
  if (audience !== "jon" && audience !== "jeff") return "All admins";
  const who = ownerName?.trim() || names?.[audience] || INBOX_FALLBACK[audience];
  return `Admin · ${who}`;
}

/** Options for choosing who decides: any admin, or one admin inbox labelled from data. */
export function adminAudienceOptions(names?: Partial<AdminInboxNames>): Array<{ value: AdminAudience; label: string }> {
  return [
    { value: "both", label: "Any admin" },
    ...ADMIN_INBOX_KEYS.map((key) => ({ value: key, label: adminAudienceLabel(key, names) })),
  ];
}
