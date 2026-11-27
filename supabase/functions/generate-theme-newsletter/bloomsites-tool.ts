// BloomSites assets as model tools for generate-theme-newsletter.
//
// Not wired into the generator's prompt yet: the generator can pass
// BLOOMSITES_TOOLS to the model and answer each call with runBloomSitesTool.
// The bridge has already checked the caller's tenant membership and only
// ever reads from BloomSites (see ../_shared/bloomsitesBridge.ts).
import type { BloomSitesBridge } from "../_shared/bloomsitesBridge.ts";

export const BLOOMSITES_TOOL_NAMES = [
  "get_bloomsites_brand",
  "get_bloomsites_products",
  "get_bloomsites_events",
] as const;
export type BloomSitesToolName = typeof BLOOMSITES_TOOL_NAMES[number];

/** OpenAI chat-completions function tools. */
export const BLOOMSITES_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_bloomsites_brand",
      description: "The store website's logo URL, brand colours and fonts.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bloomsites_products",
      description: "Products published on the store website: name, price, URL, primary image and stock.",
      parameters: {
        type: "object",
        properties: {
          collection: { type: "string", description: "Collection slug or name, e.g. christmas-trees." },
          search: { type: "string", description: "Words to match in the product name or description." },
          limit: { type: "integer", minimum: 1, maximum: 24 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_bloomsites_events",
      description: "Upcoming events on the store website: title, next date, location, image and URL. Future dates only.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Words to match in the event title." },
          limit: { type: "integer", minimum: 1, maximum: 24 },
        },
        additionalProperties: false,
      },
    },
  },
] as const;

export function isBloomSitesToolName(name: string): name is BloomSitesToolName {
  return (BLOOMSITES_TOOL_NAMES as readonly string[]).includes(name);
}

/** Answer one tool call; `rawArguments` is the model's JSON argument string. */
export async function runBloomSitesTool(
  bridge: BloomSitesBridge,
  name: BloomSitesToolName,
  rawArguments: string,
): Promise<unknown> {
  let args: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(rawArguments || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
  } catch {
    args = {};
  }
  const str = (value: unknown) => (typeof value === "string" ? value : undefined);
  const num = (value: unknown) => (typeof value === "number" ? value : undefined);
  switch (name) {
    case "get_bloomsites_brand":
      return await bridge.getBrand();
    case "get_bloomsites_products":
      return {
        products: await bridge.getProducts({ collection: str(args.collection), search: str(args.search), limit: num(args.limit) }),
      };
    case "get_bloomsites_events":
      return { events: await bridge.getEvents({ search: str(args.search), limit: num(args.limit) }) };
  }
}
