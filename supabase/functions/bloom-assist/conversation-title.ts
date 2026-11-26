/**
 * Conversation titles. A title has to tell one conversation from the next in
 * the Bloom history, so when the conversation is about a specific record (the
 * campaign, segment, customer or product the user is looking at, or one they
 * name in their first message) the title carries that record's name.
 *
 * The model may word the title, but it is held to the record: a model title
 * that leaves out the name is replaced by a deterministic one built from the
 * name and the intent of the message. Without a model key the deterministic
 * title is used directly. Nothing here invents a name.
 */
import { extractNamedEntityReferences } from "./named-entity-lookup.ts";
import { meteredModelFetch, type SpendMeter } from "./security/spend-cap.ts";
import type { EntitySummary, PageEntityType } from "./types.ts";

export interface ConversationTitleSubject {
  entityType: PageEntityType;
  name: string;
}

export const DEFAULT_CONVERSATION_TITLE = "New Bloom Chat";

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";
const TITLE_MODEL = "gpt-4o-mini";
const MAX_TITLE_CHARS = 80;
const MAX_SUBJECT_NAME_CHARS = 48;
const MAX_PLAIN_TITLE_WORDS = 6;
const MAX_SUBJECT_TITLE_WORDS = 12;

const ENTITY_LABELS: Record<PageEntityType, string> = {
  campaign: "Campaign",
  customer: "Customer",
  product: "Product",
  segment: "Segment",
};

/** Ordered: the first matching intent names the conversation. */
const INTENT_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(compare|comparison|versus|vs\.?)\b/i, label: "Comparison" },
  {
    pattern: /\b(purchase|purchases|purchasing|buying|buys|spend|spending)\b/i,
    label: "Purchase Behavior",
  },
  {
    pattern:
      /\b(perform\w*|results?|metrics?|open rates?|click\w*|conversions?|revenue|roi)\b/i,
    label: "Performance Review",
  },
  {
    pattern: /\b(improve\w*|optimi[sz]\w*|suggest\w*|recommend\w*|ideas?)\b/i,
    label: "Improvement Ideas",
  },
  {
    pattern: /\b(draft|write|compose|rewrite|create|subject lines?)\b/i,
    label: "Draft",
  },
  { pattern: /\b(stock|inventory|reorder)\b/i, label: "Stock Check" },
  { pattern: /\b(who|members?|audience)\b/i, label: "Audience" },
  {
    pattern: /\b(explain|why|summar\w*|overview|tell me about)\b/i,
    label: "Overview",
  },
];

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const titleCaseWords = (words: string[]) =>
  words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

/** The first words of the message, title-cased. */
export function fallbackTitle(message: string): string {
  const words = message
    .replace(/[^a-zA-Z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, MAX_PLAIN_TITLE_WORDS);

  if (words.length === 0) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  return titleCaseWords(words);
}

const truncateName = (name: string) => {
  const clean = collapseWhitespace(name.replace(/["`]/g, ""));
  return clean.length > MAX_SUBJECT_NAME_CHARS
    ? `${clean.slice(0, MAX_SUBJECT_NAME_CHARS - 1).trimEnd()}…`
    : clean;
};

/** What the first message asks for, as a short label. */
export function describeConversationIntent(
  message: string,
  entityType: PageEntityType,
): string {
  for (const { pattern, label } of INTENT_PATTERNS) {
    if (pattern.test(message)) {
      return label;
    }
  }

  return `${ENTITY_LABELS[entityType]} Chat`;
}

/** The deterministic title for a conversation about a named record. */
export function subjectTitle(
  subject: ConversationTitleSubject,
  message: string,
): string {
  const name = truncateName(subject.name);
  const intent = describeConversationIntent(message, subject.entityType);
  return `${name}: ${intent}`.slice(0, MAX_TITLE_CHARS);
}

/**
 * The record the conversation is about: the record on screen (resolved by the
 * server, tenant scoped) first, otherwise a record the first message names.
 */
export function resolveConversationTitleSubject(
  entitySummary: Pick<EntitySummary, "entityType" | "name"> | null,
  message: string,
): ConversationTitleSubject | null {
  const onScreenName = entitySummary ? collapseWhitespace(entitySummary.name) : "";
  if (entitySummary && onScreenName) {
    return { entityType: entitySummary.entityType, name: onScreenName };
  }

  const [named] = extractNamedEntityReferences(message);
  if (named) {
    return { entityType: named.entityType, name: collapseWhitespace(named.name) };
  }

  return null;
}

const includesName = (title: string, name: string) => {
  const lowerTitle = title.toLowerCase();
  const target = collapseWhitespace(name.replace(/["`]/g, "")).toLowerCase();
  return (
    lowerTitle.includes(target) ||
    lowerTitle.includes(target.slice(0, MAX_SUBJECT_NAME_CHARS - 1).trimEnd())
  );
};

/** Cleans a model title; falls back when it is empty or drops the record's name. */
export function sanitizeGeneratedTitle(
  value: string | null,
  message: string,
  subject: ConversationTitleSubject | null = null,
): string {
  const deterministic = () =>
    subject ? subjectTitle(subject, message) : fallbackTitle(message);
  if (!value) {
    return deterministic();
  }

  const cleaned = collapseWhitespace(value.replace(/["`]/g, ""));
  if (!cleaned) {
    return deterministic();
  }

  const title = cleaned
    .split(" ")
    .slice(0, subject ? MAX_SUBJECT_TITLE_WORDS : MAX_PLAIN_TITLE_WORDS)
    .join(" ")
    .slice(0, MAX_TITLE_CHARS);

  if (subject && !includesName(title, subject.name)) {
    return subjectTitle(subject, message);
  }

  return title;
}

function extractOpenAiTitle(payload: unknown): string | null {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !Array.isArray((payload as { choices?: unknown }).choices)
  ) {
    return null;
  }

  const [firstChoice] = (payload as { choices: unknown[] }).choices;
  if (typeof firstChoice !== "object" || firstChoice === null) {
    return null;
  }

  const message = (firstChoice as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) {
    return null;
  }

  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : null;
}

const titleInstructions = (subject: ConversationTitleSubject | null) =>
  subject
    ? `Write a concise conversation title of at most 8 words for the user's message. The conversation is about the ${subject.entityType} named "${truncateName(subject.name)}"; the title must contain that exact name. Do not mention any other record. Return only the title.`
    : "Summarize the user's message as a concise 4-6 word conversation title. Return only the title.";

export interface GenerateConversationTitleOptions {
  message: string;
  subject?: ConversationTitleSubject | null;
  openAiApiKey: string | null;
  meter?: SpendMeter | null;
  fetchImpl?: typeof fetch;
  onError?: (reason: string) => void;
}

export async function generateConversationTitle({
  message,
  subject = null,
  openAiApiKey,
  meter = null,
  fetchImpl = fetch,
  onError,
}: GenerateConversationTitleOptions): Promise<string> {
  const deterministic = subject
    ? subjectTitle(subject, message)
    : fallbackTitle(message);
  if (!openAiApiKey) {
    return deterministic;
  }

  try {
    const response = await meteredModelFetch(
      meter,
      "title",
      OPENAI_CHAT_COMPLETIONS_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: TITLE_MODEL,
          temperature: 0.2,
          max_tokens: 32,
          messages: [
            { role: "system", content: titleInstructions(subject) },
            { role: "user", content: message },
          ],
        }),
      },
      fetchImpl,
    );

    if (!response.ok) {
      onError?.(`status ${response.status}`);
      return deterministic;
    }

    const payload: unknown = await response.json();
    return sanitizeGeneratedTitle(extractOpenAiTitle(payload), message, subject);
  } catch (error) {
    onError?.(error instanceof Error ? error.message : "unknown error");
    return deterministic;
  }
}
