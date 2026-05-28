import { isBloomMode, type BloomMode } from "@/hooks/bloom/types";

export type SlashCommandCategory =
  | "Query"
  | "Analytics"
  | "Utility"
  | "Navigation"
  | "Settings"
  | "Management"
  | "Help";

export type SlashCommandParams = "none" | "optional" | "required";

export interface BloomActionContext {
  activeConversationId: string | null;
  archiveConversation: (id: string) => Promise<unknown>;
  createConversation: () => Promise<string>;
  navigate: (path: string) => void;
  openShortcutsPanel: () => void;
  sendMessage: (text: string) => Promise<void>;
  setActiveMode: (mode: BloomMode) => void;
}

export interface SlashCommand {
  command: string;
  description: string;
  category: SlashCommandCategory;
  params: SlashCommandParams;
  paramLabel?: string;
  execute: (
    params: string,
    context: BloomActionContext,
  ) => Promise<void> | void;
}

const navigationTargets: Record<string, string> = {
  activity: "/activity",
  analytics: "/analytics",
  automations: "/crm/automations",
  bloom: "/bloom",
  calendar: "/calendar",
  campaigns: "/crm/campaigns",
  customers: "/crm/customers",
  dashboard: "/dashboard",
  forms: "/crm/forms",
  integrations: "/integrations",
  newsletters: "/newsletters",
  products: "/products",
  profile: "/profile",
  publish: "/publish",
  segments: "/crm/segments",
  settings: "/settings",
  sms: "/sms",
  support: "/support",
};

const modeAliases: Record<string, BloomMode> = {
  image: "image",
  img: "image",
  reason: "reasoning",
  reasoning: "reasoning",
  research: "research",
  standard: "standard",
};

const trimParams = (params: string) => params.trim();

const requireParams = (params: string, label = "value") => {
  const normalizedParams = trimParams(params);
  if (!normalizedParams) {
    throw new Error(`This command requires ${label}.`);
  }

  return normalizedParams;
};

const normalizeNavigateTarget = (params: string) => {
  const normalized = requireParams(params, "a page").toLowerCase();
  const withoutLeadingSlash = normalized.replace(/^\/+/, "");

  if (navigationTargets[withoutLeadingSlash]) {
    return navigationTargets[withoutLeadingSlash];
  }

  const matchedTarget = Object.values(navigationTargets).find(
    (target) => target.replace(/^\/+/, "") === withoutLeadingSlash,
  );

  if (matchedTarget) {
    return matchedTarget;
  }

  throw new Error("That page is not available as a Bloom navigation shortcut.");
};

const normalizeMode = (params: string) => {
  const normalized = requireParams(params, "a mode name").toLowerCase();
  const aliasMatch = modeAliases[normalized];
  if (aliasMatch) {
    return aliasMatch;
  }

  if (isBloomMode(normalized)) {
    return normalized;
  }

  throw new Error("Use one of: standard, reasoning, research, or image.");
};

const createMessageCommand = (
  command: string,
  description: string,
  category: SlashCommandCategory,
  params: SlashCommandParams,
  paramLabel: string | undefined,
  buildMessage: (params: string) => string,
): SlashCommand => ({
  category,
  command,
  description,
  execute: async (paramsValue, context) => {
    await context.sendMessage(buildMessage(trimParams(paramsValue)));
  },
  paramLabel,
  params,
});

export const slashCommands: SlashCommand[] = [
  createMessageCommand(
    "/customers",
    "Search customers",
    "Query",
    "optional",
    "[query]",
    (params) =>
      params ? `Search customers for ${params}` : "Search customers",
  ),
  createMessageCommand(
    "/products",
    "Search products",
    "Query",
    "optional",
    "[query]",
    (params) => (params ? `Search products for ${params}` : "Search products"),
  ),
  createMessageCommand(
    "/campaigns",
    "Search campaigns",
    "Query",
    "optional",
    "[query]",
    (params) =>
      params ? `Search campaigns for ${params}` : "Search campaigns",
  ),
  createMessageCommand(
    "/stats",
    "Dashboard",
    "Analytics",
    "none",
    undefined,
    () => "Show me today's dashboard summary",
  ),
  createMessageCommand(
    "/revenue",
    "Revenue data",
    "Analytics",
    "optional",
    "[period]",
    (params) => (params ? `Show me revenue for ${params}` : "Show me revenue"),
  ),
  createMessageCommand(
    "/export",
    "Export CSV",
    "Utility",
    "optional",
    "[entity]",
    (params) =>
      params ? `Export ${params} data as CSV` : "Export data as CSV",
  ),
  {
    category: "Navigation",
    command: "/navigate",
    description: "Go to a CRM page",
    execute: (params, context) => {
      context.navigate(normalizeNavigateTarget(params));
    },
    paramLabel: "[page]",
    params: "required",
  },
  {
    category: "Settings",
    command: "/mode",
    description: "Switch Bloom mode",
    execute: (params, context) => {
      context.setActiveMode(normalizeMode(params));
    },
    paramLabel: "[name]",
    params: "required",
  },
  {
    category: "Management",
    command: "/clear",
    description: "Archive the active conversation",
    execute: async (_params, context) => {
      if (!context.activeConversationId) {
        return;
      }

      await context.archiveConversation(context.activeConversationId);
    },
    params: "none",
  },
  {
    category: "Management",
    command: "/new",
    description: "Start a new conversation",
    execute: async (_params, context) => {
      await context.createConversation();
    },
    params: "none",
  },
  {
    category: "Help",
    command: "/help",
    description: "Show shortcuts",
    execute: (_params, context) => {
      context.openShortcutsPanel();
    },
    params: "none",
  },
];

export function matchSlashCommand(input: string) {
  const trimmedInput = input.trim();
  if (!trimmedInput.startsWith("/")) {
    return null;
  }

  const withoutSlash = trimmedInput.slice(1).trim();
  if (!withoutSlash) {
    return null;
  }

  const [rawCommandToken, ...restTokens] = withoutSlash.split(/\s+/);
  const commandToken = `/${rawCommandToken.toLowerCase()}`;
  const params = restTokens.join(" ").trim();

  const exactMatch = slashCommands.find(
    (command) => command.command.toLowerCase() === commandToken,
  );
  if (exactMatch) {
    return { command: exactMatch, params };
  }

  const prefixMatches = slashCommands.filter((command) =>
    command.command.toLowerCase().startsWith(commandToken),
  );

  if (prefixMatches.length !== 1) {
    return null;
  }

  return { command: prefixMatches[0], params };
}

export async function executeSlashCommand(
  command: SlashCommand,
  params: string,
  context: BloomActionContext,
) {
  const normalizedParams = trimParams(params);

  if (command.params === "required" && !normalizedParams) {
    throw new Error(
      `Use ${command.command} ${command.paramLabel ?? "[value]"}.`,
    );
  }

  if (command.params === "none" && normalizedParams) {
    throw new Error(`${command.command} does not take parameters.`);
  }

  await command.execute(normalizedParams, context);
}
