export type InputSanitizerResult = {
  sanitized: string;
  injectionDetected: boolean;
  detectionReason: string | null;
};

type InjectionPattern = {
  reason: string;
  regex: RegExp;
};

const ZERO_WIDTH_OR_BIDI_PATTERN = /[\u200B-\u200F\u202A-\u202E\uFEFF]/g;
const ASCII_CONTROL_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;
const SENTENCE_DIRECTIVE_PREFIX = "(?:^|[\\n.!?]\\s*)(?:please\\s+)?";
const BASE64_CANDIDATE_PATTERN = /(?:^|\s)([A-Za-z0-9+/]{24,}={0,2})(?=$|\s)/g;
const MAX_BASE64_CANDIDATES = 5;
const MAX_BASE64_DECODED_CHARS = 2_000;

const INJECTION_PATTERNS: InjectionPattern[] = [
  {
    reason: "ignore_previous_instructions",
    regex: new RegExp(
      `${SENTENCE_DIRECTIVE_PREFIX}ignore\\s+(?:all\\s+)?(?:previous|prior|earlier|above|system|developer)\\s+(?:instructions|rules|messages|prompts)\\b`,
      "i",
    ),
  },
  {
    reason: "ignore_all_prior",
    regex: new RegExp(
      `${SENTENCE_DIRECTIVE_PREFIX}ignore\\s+all\\s+prior\\b`,
      "i",
    ),
  },
  {
    reason: "role_reassignment",
    regex: new RegExp(
      `${SENTENCE_DIRECTIVE_PREFIX}you\\s+are\\s+now\\s+(?:an?\\s+)?(?:admin|developer|system|unrestricted|jailbroken|different)\\b`,
      "i",
    ),
  },
  {
    reason: "new_instruction_block",
    regex: new RegExp(
      `${SENTENCE_DIRECTIVE_PREFIX}(?:new\\s+instructions|system|developer|admin\\s+mode|developer\\s+mode)\\s*:`,
      "i",
    ),
  },
  {
    reason: "privileged_mode_directive",
    regex: new RegExp(
      `${SENTENCE_DIRECTIVE_PREFIX}(?:admin\\s+mode|developer\\s+mode)\\b(?:\\s*[:!-]|$)`,
      "i",
    ),
  },
  {
    reason: "system_role_block",
    regex: new RegExp(
      `${SENTENCE_DIRECTIVE_PREFIX}\\[(?:system|developer|admin)\\]`,
      "i",
    ),
  },
  {
    reason: "role_play_directive",
    regex: new RegExp(
      `${SENTENCE_DIRECTIVE_PREFIX}(?:pretend\\s+you\\s+are|act\\s+as\\s+if)\\s+(?:an?\\s+)?(?:admin|developer|system|unrestricted|jailbroken|different)\\b`,
      "i",
    ),
  },
];

function decodeBase64Candidate(value: string): string | null {
  if (value.length % 4 === 1) {
    return null;
  }

  try {
    const decoded = atob(value);
    if (!decoded || decoded.length > MAX_BASE64_DECODED_CHARS) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function detectInjection(message: string): string | null {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.regex.test(message)) {
      return pattern.reason;
    }
  }

  let checkedCandidates = 0;
  for (const match of message.matchAll(BASE64_CANDIDATE_PATTERN)) {
    if (checkedCandidates >= MAX_BASE64_CANDIDATES) {
      break;
    }
    checkedCandidates += 1;

    const decoded = decodeBase64Candidate(match[1]);
    if (decoded && detectInjection(decoded)) {
      return "base64_encoded_instruction_block";
    }
  }

  return null;
}

export function sanitizeInput(message: string): InputSanitizerResult {
  const sanitized = message
    .replace(ZERO_WIDTH_OR_BIDI_PATTERN, "")
    .replace(ASCII_CONTROL_PATTERN, "");
  const detectionReason = detectInjection(sanitized);

  return {
    sanitized,
    injectionDetected: Boolean(detectionReason),
    detectionReason,
  };
}
