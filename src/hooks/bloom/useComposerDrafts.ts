import * as React from "react";

/**
 * Composer drafts keyed by the context they were written for: a conversation,
 * or the not-yet-started conversation about one resource. A draft (typed, or
 * prefilled by a prompt link) only ever shows in its own context, so a prompt
 * written for one customer, campaign or conversation never leaks into another.
 */
export interface ComposerDrafts {
  /** The draft for `key`, or an empty string. */
  getDraft: (key: string) => string;
  /** Replaces the draft for `key`; an empty value removes it. */
  setDraft: (key: string, value: React.SetStateAction<string>) => void;
}

export function useComposerDrafts(): ComposerDrafts {
  const [drafts, setDrafts] = React.useState<Readonly<Record<string, string>>>(
    {},
  );

  const getDraft = React.useCallback(
    (key: string) => drafts[key] ?? "",
    [drafts],
  );

  const setDraft = React.useCallback(
    (key: string, value: React.SetStateAction<string>) => {
      setDrafts((current) => {
        const previous = current[key] ?? "";
        const next = typeof value === "function" ? value(previous) : value;
        if (next === previous) {
          return current;
        }

        const updated = { ...current };
        if (next) {
          updated[key] = next;
        } else {
          delete updated[key];
        }
        return updated;
      });
    },
    [],
  );

  return React.useMemo(() => ({ getDraft, setDraft }), [getDraft, setDraft]);
}

/** The draft key for /bloom: the conversation, or the new-conversation view. */
export const bloomPageDraftKey = (conversationId: string | null) =>
  conversationId ? `conversation:${conversationId}` : "new";

/**
 * The draft key for the Ask Bloom drawer: the conversation once it exists,
 * otherwise the resource the drawer is focused on (or a general chat).
 */
export const askBloomDraftKey = (
  conversationId: string | null,
  resource: { resourceType: string; resourceId: string } | null,
) => {
  if (conversationId) {
    return `conversation:${conversationId}`;
  }

  return resource
    ? `new:${resource.resourceType}:${resource.resourceId}`
    : "new:general";
};
