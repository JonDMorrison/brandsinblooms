import type { AskBloomResourceType } from "@/types/askBloom";

export interface ParsedAskBloomResourceRoute {
  resourceType: AskBloomResourceType;
  resourceId: string;
}

interface AskBloomRouteMatcher {
  resourceType: AskBloomResourceType;
  pattern: RegExp;
  reservedIds?: Set<string>;
}

const CAMPAIGN_RESERVED_IDS = new Set(["new", "blocks"]);
const SEGMENT_RESERVED_IDS = new Set(["new", "beta"]);
const AUTOMATION_RESERVED_IDS = new Set(["new"]);

const ROUTE_MATCHERS: AskBloomRouteMatcher[] = [
  {
    resourceType: "customer",
    pattern: /^\/crm\/customers\/([^/]+)\/?$/i,
  },
  {
    resourceType: "product",
    pattern: /^\/products\/([^/]+)\/?$/i,
    reservedIds: new Set(["new"]),
  },
  {
    resourceType: "campaign",
    pattern:
      /^\/(?:crm|dashboard)\/campaigns\/([^/]+)(?:\/(?:edit|analytics|report|recipients(?:\/[^/]+)?))?\/?$/i,
    reservedIds: CAMPAIGN_RESERVED_IDS,
  },
  {
    resourceType: "segment",
    pattern: /^\/crm\/segments\/([^/]+)(?:\/members)?\/?$/i,
    reservedIds: SEGMENT_RESERVED_IDS,
  },
  {
    resourceType: "automation",
    pattern: /^\/crm\/automations\/([^/]+)(?:\/executions)?\/?$/i,
    reservedIds: AUTOMATION_RESERVED_IDS,
  },
];

const normalizePathname = (pathname: string) => {
  if (!pathname) {
    return "/";
  }

  const trimmed = pathname.trim();
  if (trimmed === "/") {
    return "/";
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

export function humanizeAskBloomResourceType(resourceType: AskBloomResourceType) {
  return resourceType.charAt(0).toUpperCase() + resourceType.slice(1);
}

export function parseResourceFromPath(
  pathname: string,
): ParsedAskBloomResourceRoute | null {
  const normalizedPathname = normalizePathname(pathname);

  for (const matcher of ROUTE_MATCHERS) {
    const match = normalizedPathname.match(matcher.pattern);
    if (!match) {
      continue;
    }

    const resourceId = match[1]?.trim();
    if (!resourceId) {
      return null;
    }

    if (matcher.reservedIds?.has(resourceId.toLowerCase())) {
      return null;
    }

    return {
      resourceType: matcher.resourceType,
      resourceId,
    };
  }

  return null;
}
