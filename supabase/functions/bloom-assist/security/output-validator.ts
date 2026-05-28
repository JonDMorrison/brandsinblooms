import { BASE_SYSTEM_PROMPT } from "../prompts/base-system-prompt.ts";

export type OutputValidationResult = {
  valid: boolean;
  sanitizedResponse: string;
  violationType: string | null;
  offendingContentFragment?: string | null;
  suspiciousEntityIds: string[];
};

export type OutputValidationContext = {
  knownEntityIds?: ReadonlySet<string>;
};

const SAFE_FALLBACK_RESPONSE =
  "I encountered an issue generating this response. Please try rephrasing your question.";
const ENV_VAR_PATTERN = /\b[A-Z][A-Z0-9_]*(?:_KEY|_SECRET|_TOKEN|_PASSWORD)\b/;
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const INTERNAL_TABLES = [
  "bloom_audit_log",
  "bloom_tool_executions",
  "bloom_user_profiles",
  "bloom_proactive_insights",
  "provider_connections",
  "auth.users",
];
const RAW_CONFIG_PATTERNS = [
  /\{\s*"type"\s*:\s*"function"\s*,\s*"function"\s*:\s*\{/i,
  /"tool_choice"\s*:\s*"auto"/i,
  /"parameters"\s*:\s*\{[\s\S]{0,500}"properties"\s*:/i,
  /"service_role(?:_key)?"\s*:/i,
  /"messages"\s*:\s*\[[\s\S]{0,500}"role"\s*:\s*"system"/i,
];
const SYSTEM_PROMPT_SENTINELS = BASE_SYSTEM_PROMPT.split(/\n\s*\n/)
  .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
  .filter((paragraph) => paragraph.length >= 40)
  .map((paragraph) => paragraph.slice(0, 50));

function fragmentAt(response: string, index: number, length: number): string {
  const start = Math.max(0, index - 20);
  const end = Math.min(response.length, index + length + 20);
  return response.slice(start, end).replace(/\s+/g, " ").trim();
}

function invalidResult(
  response: string,
  violationType: string,
  index: number,
  length: number,
): OutputValidationResult {
  return {
    valid: false,
    sanitizedResponse: SAFE_FALLBACK_RESPONSE,
    violationType,
    offendingContentFragment: fragmentAt(response, index, length),
    suspiciousEntityIds: [],
  };
}

function extractUuidCandidates(response: string): string[] {
  UUID_PATTERN.lastIndex = 0;
  const matches = response.match(UUID_PATTERN);
  if (!matches) {
    return [];
  }

  return [...new Set(matches.map((match) => match.toLowerCase()))];
}

function findInternalTable(
  response: string,
): { table: string; index: number } | null {
  const lowerResponse = response.toLowerCase();
  for (const table of INTERNAL_TABLES) {
    const index = lowerResponse.indexOf(table.toLowerCase());
    if (index !== -1) {
      return { table, index };
    }
  }

  return null;
}

export function validateOutput(
  response: string,
  userRole: string,
  context: OutputValidationContext = {},
): OutputValidationResult {
  for (const sentinel of SYSTEM_PROMPT_SENTINELS) {
    const index = response.indexOf(sentinel);
    if (index !== -1) {
      return invalidResult(
        response,
        "system_prompt_fragment",
        index,
        sentinel.length,
      );
    }
  }

  const envMatch = response.match(ENV_VAR_PATTERN);
  if (envMatch?.index !== undefined) {
    return invalidResult(
      response,
      "environment_variable_reference",
      envMatch.index,
      envMatch[0].length,
    );
  }

  if (userRole !== "admin") {
    const internalTable = findInternalTable(response);
    if (internalTable) {
      return invalidResult(
        response,
        "internal_table_reference",
        internalTable.index,
        internalTable.table.length,
      );
    }
  }

  for (const pattern of RAW_CONFIG_PATTERNS) {
    const match = response.match(pattern);
    if (match?.index !== undefined) {
      return invalidResult(
        response,
        "raw_system_configuration",
        match.index,
        match[0].length,
      );
    }
  }

  const responseEntityIds = extractUuidCandidates(response);
  const suspiciousEntityIds = context.knownEntityIds
    ? responseEntityIds.filter(
        (entityId) => !context.knownEntityIds?.has(entityId),
      )
    : [];

  return {
    valid: true,
    sanitizedResponse: response,
    violationType: null,
    offendingContentFragment: null,
    suspiciousEntityIds,
  };
}
