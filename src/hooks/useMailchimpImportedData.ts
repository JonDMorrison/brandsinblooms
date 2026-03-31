import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useDebouncedValue } from "@/components/integrations/shared/dataTabPrimitives";

type CustomerRow = Database["public"]["Tables"]["crm_customers"]["Row"];
type CustomerSourceRow =
  Database["public"]["Tables"]["customer_sources"]["Row"];
type SegmentRow = Database["public"]["Tables"]["crm_segments"]["Row"];
type TagRow = Database["public"]["Tables"]["crm_tags"]["Row"];
type ConsentRow = Database["public"]["Tables"]["customer_consents"]["Row"];
type SuppressionRow = Database["public"]["Tables"]["suppression_list"]["Row"];

const QUERY_STALE_TIME = 60_000;
const CUSTOMER_PAGE_SIZE = 25;
const COMPLIANCE_PAGE_SIZE = 25;
const CHUNK_SIZE = 500;

type CustomerCore = Pick<
  CustomerRow,
  "id" | "email" | "first_name" | "last_name" | "phone"
>;

type CustomerSourceJoinRow = Pick<
  CustomerSourceRow,
  "customer_id" | "source_id" | "imported_at" | "created_at"
> & {
  crm_customers: CustomerCore | CustomerCore[] | null;
};

type CustomerSegmentJoinRow = {
  customer_id: string;
  crm_segments:
    | Pick<SegmentRow, "id" | "name">
    | Array<Pick<SegmentRow, "id" | "name">>
    | null;
};

type CustomerTagJoinRow = {
  contact_id: string;
  crm_tags:
    | Pick<TagRow, "id" | "name" | "created_at">
    | Array<Pick<TagRow, "id" | "name" | "created_at">>
    | null;
};

type SegmentArtifactRow = {
  artifact_type: string;
  external_id: string;
  name: string | null;
  data: Record<string, unknown> | null;
};

type SegmentMemberPreviewJoinRow = {
  customer_id: string;
  crm_customers:
    | Pick<CustomerRow, "email">
    | Array<Pick<CustomerRow, "email">>
    | null;
};

export type MailchimpImportedSection =
  | "customers"
  | "segments"
  | "tags"
  | "compliance";

export type MailchimpImportedSummary = {
  totalCustomers: number;
  totalSegments: number;
  totalTags: number;
  activeConsentRecords: number;
  activeSuppressions: number;
};

export type MailchimpCustomerPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type MailchimpImportedCustomerRow = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  importedAt: string;
  sourceId: string | null;
  segments: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string }>;
  latestConsent: MailchimpConsentRecord | null;
  activeSuppression: MailchimpSuppressionRecord | null;
  allSuppressions: MailchimpSuppressionRecord[];
};

export type MailchimpImportedCustomerState = {
  rows: MailchimpImportedCustomerRow[];
  pagination: MailchimpCustomerPagination;
};

export type MailchimpImportedSegmentRow = {
  id: string;
  name: string;
  sourceId: string | null;
  memberCount: number;
  createdAt: string | null;
  parentListId: string | null;
  parentListName: string | null;
};

export type MailchimpImportedTagRow = {
  id: string;
  name: string;
  createdAt: string | null;
  customerCount: number;
};

export type MailchimpConsentRecord = {
  id: string;
  customerId: string;
  email: string;
  channel: string;
  status: string;
  statusLabel: string;
  recordedAt: string;
};

export type MailchimpSuppressionRecord = {
  id: string;
  customerId: string | null;
  email: string | null;
  phone: string | null;
  channel: string;
  reason: string;
  suppressedAt: string | null;
  active: boolean;
  suppressionType: string;
};

export type MailchimpComplianceSummaryCard = {
  key: string;
  label: string;
  value: number;
};

export type MailchimpImportedComplianceData = {
  consentRows: MailchimpConsentRecord[];
  suppressionRows: MailchimpSuppressionRecord[];
  consentSummaryCards: MailchimpComplianceSummaryCard[];
  activeConsentRecords: number;
  activeSuppressions: number;
};

type MailchimpScopeRow = {
  customerId: string;
  email: string | null;
};

type PageCustomerEnrichment = {
  segmentsByCustomerId: Map<string, Array<{ id: string; name: string }>>;
  tagsByCustomerId: Map<string, Array<{ id: string; name: string }>>;
  latestConsentByCustomerId: Map<string, MailchimpConsentRecord>;
  suppressionsByCustomerId: Map<string, MailchimpSuppressionRecord[]>;
  suppressionsByEmail: Map<string, MailchimpSuppressionRecord[]>;
};

export function buildMailchimpCustomerSearchFilter(
  rawSearch: string,
  fieldPrefix = "",
) {
  const sanitized = rawSearch
    .replace(/[(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) {
    return "";
  }

  const prefix = fieldPrefix;
  const tokens = sanitized.split(" ").filter(Boolean);
  const orParts: string[] = [
    `${prefix}email.ilike.%${sanitized}%`,
    `${prefix}first_name.ilike.%${sanitized}%`,
    `${prefix}last_name.ilike.%${sanitized}%`,
  ];

  if (tokens.length > 1) {
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    orParts.push(
      `and(${prefix}first_name.ilike.%${first}%,${prefix}last_name.ilike.%${last}%)`,
    );
    orParts.push(
      `and(${prefix}first_name.ilike.%${last}%,${prefix}last_name.ilike.%${first}%)`,
    );

    for (const token of tokens) {
      orParts.push(`${prefix}email.ilike.%${token}%`);
      orParts.push(`${prefix}first_name.ilike.%${token}%`);
      orParts.push(`${prefix}last_name.ilike.%${token}%`);
    }
  }

  return orParts.join(",");
}

export function normalizeMailchimpEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function getMailchimpConsentStatusLabel(status?: string | null) {
  switch (status) {
    case "opted_in":
      return "Subscribed";
    case "opted_out":
      return "Unsubscribed";
    case "suppressed":
      return "Suppressed";
    default:
      return "Unknown";
  }
}

export function mergeMatchedSuppressions(
  directMatches: SuppressionRow[],
  emailMatches: SuppressionRow[],
) {
  const deduped = new Map<string, SuppressionRow>();

  for (const row of [...directMatches, ...emailMatches]) {
    deduped.set(row.id, row);
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const leftTime = left.suppressed_at ?? "";
    const rightTime = right.suppressed_at ?? "";
    return rightTime.localeCompare(leftTime);
  });
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

function chunkArray<T>(values: T[], size = CHUNK_SIZE) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function getRelatedRow<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function buildMailchimpSegmentArtifactLookup(
  artifactRows: SegmentArtifactRow[],
) {
  const listNameById = new Map<string, string>();
  const artifactMatchesBySegmentName = new Map<
    string,
    Array<{ sourceId: string; parentListId: string | null }>
  >();

  for (const artifact of artifactRows) {
    if (artifact.artifact_type === "list") {
      listNameById.set(
        artifact.external_id,
        artifact.name ?? artifact.external_id,
      );
      continue;
    }

    const parentListId =
      artifact.data && typeof artifact.data.parent_list_id === "string"
        ? artifact.data.parent_list_id
        : null;
    const segmentName = artifact.name?.trim();

    if (!segmentName) {
      continue;
    }

    const matches = artifactMatchesBySegmentName.get(segmentName) ?? [];
    matches.push({ sourceId: artifact.external_id, parentListId });
    artifactMatchesBySegmentName.set(segmentName, matches);
  }

  const lookup = new Map<
    string,
    { sourceId: string | null; parentListId: string | null; parentListName: string | null }
  >();

  for (const [segmentName, matches] of artifactMatchesBySegmentName.entries()) {
    if (matches.length !== 1) {
      lookup.set(segmentName, {
        sourceId: null,
        parentListId: null,
        parentListName: null,
      });
      continue;
    }

    const match = matches[0];
    lookup.set(segmentName, {
      sourceId: match.sourceId,
      parentListId: match.parentListId,
      parentListName: match.parentListId
        ? (listNameById.get(match.parentListId) ?? match.parentListId)
        : null,
    });
  }

  return lookup;
}

function intersectIdLists(
  primary: string[] | null,
  secondary: string[] | null,
) {
  if (!primary) {
    return secondary;
  }

  if (!secondary) {
    return primary;
  }

  const secondarySet = new Set(secondary);
  return primary.filter((value) => secondarySet.has(value));
}

function createPagination(
  page: number,
  totalCount: number,
  pageSize = CUSTOMER_PAGE_SIZE,
) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    page,
    pageSize,
    totalCount,
    totalPages,
  } satisfies MailchimpCustomerPagination;
}

function createCompliancePagination(page: number, totalCount: number) {
  const totalPages = Math.max(1, Math.ceil(totalCount / COMPLIANCE_PAGE_SIZE));

  return {
    page,
    pageSize: COMPLIANCE_PAGE_SIZE,
    totalCount,
    totalPages,
  };
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

async function fetchMailchimpScopeRows(tenantId: string) {
  const { data, error } = await supabase
    .from("customer_sources")
    .select("customer_id, crm_customers!inner(email)")
    .eq("tenant_id", tenantId)
    .eq("source_type", "mailchimp");

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as Array<{
      customer_id: string;
      crm_customers:
        | Pick<CustomerRow, "email">
        | Array<Pick<CustomerRow, "email">>
        | null;
    }>
  ).map((row) => {
    const customer = getRelatedRow(row.crm_customers);

    return {
      customerId: row.customer_id,
      email: normalizeMailchimpEmail(customer?.email ?? null),
    } satisfies MailchimpScopeRow;
  });
}

async function fetchChunkedRows<T>(
  values: string[],
  loader: (chunk: string[]) => Promise<T[]>,
) {
  if (values.length === 0) {
    return [] as T[];
  }

  const chunks = chunkArray(values);
  const responses = await Promise.all(chunks.map((chunk) => loader(chunk)));
  return responses.flat();
}

async function fetchMatchingCustomerIdsForSegments(segmentId?: string | null) {
  let query = supabase.from("customer_segments").select("customer_id");

  if (segmentId) {
    query = query.eq("segment_id", segmentId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return uniqueStrings((data ?? []).map((row) => row.customer_id));
}

async function fetchMatchingCustomerIdsForTags(tagId?: string | null) {
  let query = supabase.from("customer_tags").select("contact_id");

  if (tagId) {
    query = query.eq("tag_id", tagId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return uniqueStrings((data ?? []).map((row) => row.contact_id));
}

async function resolveCustomerFilterIds(options: {
  hasSegments: boolean;
  hasTags: boolean;
  segmentId?: string | null;
  tagId?: string | null;
}) {
  const needsSegments = options.hasSegments || Boolean(options.segmentId);
  const needsTags = options.hasTags || Boolean(options.tagId);

  if (!needsSegments && !needsTags) {
    return null;
  }

  const [segmentIds, tagIds] = await Promise.all([
    needsSegments
      ? fetchMatchingCustomerIdsForSegments(options.segmentId)
      : Promise.resolve(null),
    needsTags
      ? fetchMatchingCustomerIdsForTags(options.tagId)
      : Promise.resolve(null),
  ]);

  return intersectIdLists(segmentIds, tagIds) ?? [];
}

async function fetchCustomerPageEnrichment(
  tenantId: string,
  customerIds: string[],
  emails: string[],
): Promise<PageCustomerEnrichment> {
  if (customerIds.length === 0) {
    return {
      segmentsByCustomerId: new Map(),
      tagsByCustomerId: new Map(),
      latestConsentByCustomerId: new Map(),
      suppressionsByCustomerId: new Map(),
      suppressionsByEmail: new Map(),
    };
  }

  const [
    segmentRows,
    tagRows,
    consentRows,
    directSuppressions,
    emailSuppressions,
  ] = await Promise.all([
    fetchChunkedRows(customerIds, async (chunk) => {
      const { data, error } = await supabase
        .from("customer_segments")
        .select("customer_id, crm_segments!inner(id, name)")
        .in("customer_id", chunk);

      if (error) {
        throw error;
      }

      return (data ?? []) as CustomerSegmentJoinRow[];
    }),
    fetchChunkedRows(customerIds, async (chunk) => {
      const { data, error } = await supabase
        .from("customer_tags")
        .select("contact_id, crm_tags!inner(id, name, created_at)")
        .in("contact_id", chunk);

      if (error) {
        throw error;
      }

      return (data ?? []) as CustomerTagJoinRow[];
    }),
    fetchChunkedRows(customerIds, async (chunk) => {
      const { data, error } = await supabase
        .from("customer_consents")
        .select("id, customer_id, channel, status, consent_timestamp")
        .in("customer_id", chunk)
        .order("consent_timestamp", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as ConsentRow[];
    }),
    fetchChunkedRows(customerIds, async (chunk) => {
      const { data, error } = await supabase
        .from("suppression_list")
        .select(
          "id, customer_id, email, phone, channel, reason, suppressed_at, lifted_at, suppression_type",
        )
        .eq("tenant_id", tenantId)
        .is("lifted_at", null)
        .in("customer_id", chunk);

      if (error) {
        throw error;
      }

      return (data ?? []) as SuppressionRow[];
    }),
    fetchChunkedRows(uniqueStrings(emails), async (chunk) => {
      const { data, error } = await supabase
        .from("suppression_list")
        .select(
          "id, customer_id, email, phone, channel, reason, suppressed_at, lifted_at, suppression_type",
        )
        .eq("tenant_id", tenantId)
        .is("lifted_at", null)
        .in("email", chunk);

      if (error) {
        throw error;
      }

      return (data ?? []) as SuppressionRow[];
    }),
  ]);

  const segmentsByCustomerId = new Map<
    string,
    Array<{ id: string; name: string }>
  >();
  for (const row of segmentRows) {
    const segment = getRelatedRow(row.crm_segments);
    if (!segment) {
      continue;
    }

    const existing = segmentsByCustomerId.get(row.customer_id) ?? [];
    existing.push({ id: segment.id, name: segment.name });
    existing.sort((left, right) => left.name.localeCompare(right.name));
    segmentsByCustomerId.set(row.customer_id, existing);
  }

  const tagsByCustomerId = new Map<
    string,
    Array<{ id: string; name: string }>
  >();
  for (const row of tagRows) {
    const tag = getRelatedRow(row.crm_tags);
    if (!tag) {
      continue;
    }

    const existing = tagsByCustomerId.get(row.contact_id) ?? [];
    existing.push({ id: tag.id, name: tag.name });
    existing.sort((left, right) => left.name.localeCompare(right.name));
    tagsByCustomerId.set(row.contact_id, existing);
  }

  const latestConsentByCustomerId = new Map<string, MailchimpConsentRecord>();
  for (const row of consentRows) {
    if (latestConsentByCustomerId.has(row.customer_id)) {
      continue;
    }

    latestConsentByCustomerId.set(row.customer_id, {
      id: row.id,
      customerId: row.customer_id,
      email: "",
      channel: row.channel,
      status: row.status,
      statusLabel: getMailchimpConsentStatusLabel(row.status),
      recordedAt: row.consent_timestamp,
    });
  }

  const mergedSuppressions = mergeMatchedSuppressions(
    directSuppressions,
    emailSuppressions,
  );
  const suppressionsByCustomerId = new Map<
    string,
    MailchimpSuppressionRecord[]
  >();
  const suppressionsByEmail = new Map<string, MailchimpSuppressionRecord[]>();

  for (const row of mergedSuppressions) {
    const record = mapSuppressionRow(row);
    if (row.customer_id) {
      const customerRecords =
        suppressionsByCustomerId.get(row.customer_id) ?? [];
      customerRecords.push(record);
      suppressionsByCustomerId.set(row.customer_id, customerRecords);
    }

    const normalizedEmail = normalizeMailchimpEmail(row.email);
    if (normalizedEmail) {
      const emailRecords = suppressionsByEmail.get(normalizedEmail) ?? [];
      emailRecords.push(record);
      suppressionsByEmail.set(normalizedEmail, emailRecords);
    }
  }

  return {
    segmentsByCustomerId,
    tagsByCustomerId,
    latestConsentByCustomerId,
    suppressionsByCustomerId,
    suppressionsByEmail,
  };
}

function mapSuppressionRow(row: SuppressionRow): MailchimpSuppressionRecord {
  return {
    id: row.id,
    customerId: row.customer_id,
    email: normalizeMailchimpEmail(row.email),
    phone: row.phone,
    channel: row.channel,
    reason: row.reason ?? row.suppression_type,
    suppressedAt: row.suppressed_at,
    active: !row.lifted_at,
    suppressionType: row.suppression_type,
  };
}

async function fetchMailchimpTagRows(tenantId: string) {
  const scopeRows = await fetchMailchimpScopeRows(tenantId);
  const customerIds = uniqueStrings(scopeRows.map((row) => row.customerId));

  if (customerIds.length === 0) {
    return [] as MailchimpImportedTagRow[];
  }

  const links = await fetchChunkedRows(customerIds, async (chunk) => {
    const { data, error } = await supabase
      .from("customer_tags")
      .select("contact_id, tag_id")
      .in("contact_id", chunk);

    if (error) {
      throw error;
    }

    return data ?? [];
  });

  const tagIds = uniqueStrings(links.map((row) => row.tag_id));
  if (tagIds.length === 0) {
    return [] as MailchimpImportedTagRow[];
  }

  const tags = await fetchChunkedRows(tagIds, async (chunk) => {
    const { data, error } = await supabase
      .from("crm_tags")
      .select("id, name, created_at")
      .eq("tenant_id", tenantId)
      .in("id", chunk);

    if (error) {
      throw error;
    }

    return (data ?? []) as Pick<TagRow, "id" | "name" | "created_at">[];
  });

  const counts = new Map<string, Set<string>>();
  for (const row of links) {
    const existing = counts.get(row.tag_id) ?? new Set<string>();
    existing.add(row.contact_id);
    counts.set(row.tag_id, existing);
  }

  return tags
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      createdAt: tag.created_at,
      customerCount: counts.get(tag.id)?.size ?? 0,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function fetchMailchimpComplianceData(tenantId: string) {
  const scopeRows = await fetchMailchimpScopeRows(tenantId);
  const customerIds = uniqueStrings(scopeRows.map((row) => row.customerId));
  const emailByCustomerId = new Map(
    scopeRows.map((row) => [row.customerId, row.email]),
  );
  const normalizedEmails = uniqueStrings(scopeRows.map((row) => row.email));

  if (customerIds.length === 0) {
    return {
      consentRows: [],
      suppressionRows: [],
      consentSummaryCards: [],
      activeConsentRecords: 0,
      activeSuppressions: 0,
    } satisfies MailchimpImportedComplianceData;
  }

  const [consentRowsRaw, directSuppressions, emailSuppressions] =
    await Promise.all([
      fetchChunkedRows(customerIds, async (chunk) => {
        const { data, error } = await supabase
          .from("customer_consents")
          .select("id, customer_id, channel, status, consent_timestamp")
          .in("customer_id", chunk)
          .order("consent_timestamp", { ascending: false });

        if (error) {
          throw error;
        }

        return (data ?? []) as ConsentRow[];
      }),
      fetchChunkedRows(customerIds, async (chunk) => {
        const { data, error } = await supabase
          .from("suppression_list")
          .select(
            "id, customer_id, email, phone, channel, reason, suppressed_at, lifted_at, suppression_type",
          )
          .eq("tenant_id", tenantId)
          .is("lifted_at", null)
          .in("customer_id", chunk);

        if (error) {
          throw error;
        }

        return (data ?? []) as SuppressionRow[];
      }),
      fetchChunkedRows(normalizedEmails, async (chunk) => {
        const { data, error } = await supabase
          .from("suppression_list")
          .select(
            "id, customer_id, email, phone, channel, reason, suppressed_at, lifted_at, suppression_type",
          )
          .eq("tenant_id", tenantId)
          .is("lifted_at", null)
          .in("email", chunk);

        if (error) {
          throw error;
        }

        return (data ?? []) as SuppressionRow[];
      }),
    ]);

  const consentRows = consentRowsRaw
    .map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      email: emailByCustomerId.get(row.customer_id) ?? "Unknown",
      channel: row.channel,
      status: row.status,
      statusLabel: getMailchimpConsentStatusLabel(row.status),
      recordedAt: row.consent_timestamp,
    }))
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));

  const consentSummaryMap = new Map<string, number>();
  for (const row of consentRows) {
    const key = `${row.channel}:${row.statusLabel}`;
    consentSummaryMap.set(key, (consentSummaryMap.get(key) ?? 0) + 1);
  }

  const consentSummaryCards = Array.from(consentSummaryMap.entries())
    .map(([key, value]) => ({
      key,
      label: key.replace(":", " · "),
      value,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  const suppressionRows = mergeMatchedSuppressions(
    directSuppressions,
    emailSuppressions,
  ).map(mapSuppressionRow);

  return {
    consentRows,
    suppressionRows,
    consentSummaryCards,
    activeConsentRecords: consentRows.filter((row) => row.status === "opted_in")
      .length,
    activeSuppressions: suppressionRows.length,
  } satisfies MailchimpImportedComplianceData;
}

export function useMailchimpImportedDataSummary() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const tagsQuery = useMailchimpImportedTags({ enabled: Boolean(tenantId) });
  const complianceQuery = useMailchimpImportedCompliance({
    enabled: Boolean(tenantId),
  });

  const customerCountQuery = useQuery({
    queryKey: ["mailchimp-imported-customer-count", tenantId],
    queryFn: async () => {
      if (!tenantId) {
        return 0;
      }

      const { count, error } = await supabase
        .from("customer_sources")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("source_type", "mailchimp");

      if (error) {
        throw error;
      }

      return count ?? 0;
    },
    enabled: Boolean(tenantId),
    staleTime: QUERY_STALE_TIME,
  });

  const segmentCountQuery = useQuery({
    queryKey: ["mailchimp-imported-segment-count", tenantId],
    queryFn: async () => {
      if (!tenantId) {
        return 0;
      }

      const { count, error } = await supabase
        .from("crm_segments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("source", "mailchimp");

      if (error) {
        throw error;
      }

      return count ?? 0;
    },
    enabled: Boolean(tenantId),
    staleTime: QUERY_STALE_TIME,
  });

  const summary = useMemo(() => {
    return {
      totalCustomers: customerCountQuery.data ?? 0,
      totalSegments: segmentCountQuery.data ?? 0,
      totalTags: tagsQuery.data?.length ?? 0,
      activeConsentRecords: complianceQuery.data?.activeConsentRecords ?? 0,
      activeSuppressions: complianceQuery.data?.activeSuppressions ?? 0,
    } satisfies MailchimpImportedSummary;
  }, [
    complianceQuery.data?.activeConsentRecords,
    complianceQuery.data?.activeSuppressions,
    customerCountQuery.data,
    segmentCountQuery.data,
    tagsQuery.data,
  ]);

  return {
    data: summary,
    loading:
      customerCountQuery.isLoading ||
      segmentCountQuery.isLoading ||
      tagsQuery.isLoading ||
      complianceQuery.isLoading,
    error:
      customerCountQuery.error ||
      segmentCountQuery.error ||
      tagsQuery.error ||
      complianceQuery.error ||
      null,
  };
}

export function useMailchimpImportedCustomers(options: {
  page: number;
  search: string;
  hasSegments: boolean;
  hasTags: boolean;
  segmentId?: string | null;
  tagId?: string | null;
}) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const debouncedSearch = useDebouncedValue(options.search, 300);

  return useQuery({
    queryKey: [
      "mailchimp-imported-customers",
      tenantId,
      options.page,
      debouncedSearch,
      options.hasSegments,
      options.hasTags,
      options.segmentId ?? null,
      options.tagId ?? null,
    ],
    queryFn: async () => {
      if (!tenantId) {
        return {
          rows: [],
          pagination: createPagination(options.page, 0),
        } satisfies MailchimpImportedCustomerState;
      }

      const filteredCustomerIds = await resolveCustomerFilterIds({
        hasSegments: options.hasSegments,
        hasTags: options.hasTags,
        segmentId: options.segmentId,
        tagId: options.tagId,
      });

      if (filteredCustomerIds && filteredCustomerIds.length === 0) {
        return {
          rows: [],
          pagination: createPagination(options.page, 0),
        } satisfies MailchimpImportedCustomerState;
      }

      let query = supabase
        .from("customer_sources")
        .select(
          "customer_id, source_id, imported_at, created_at, crm_customers!inner(id, email, first_name, last_name, phone)",
          { count: "exact" },
        )
        .eq("tenant_id", tenantId)
        .eq("source_type", "mailchimp")
        .order("imported_at", { ascending: false })
        .range(
          (Math.max(options.page, 1) - 1) * CUSTOMER_PAGE_SIZE,
          Math.max(options.page, 1) * CUSTOMER_PAGE_SIZE - 1,
        );

      if (debouncedSearch) {
        const filter = buildMailchimpCustomerSearchFilter(
          debouncedSearch,
          "crm_customers.",
        );
        if (filter) {
          query = query.or(filter);
        }
      }

      if (filteredCustomerIds) {
        query = query.in("customer_id", filteredCustomerIds);
      }

      const { data, error, count } = await query;
      if (error) {
        throw error;
      }

      const baseRows = ((data ?? []) as CustomerSourceJoinRow[])
        .map((row) => {
          const customer = getRelatedRow(row.crm_customers);

          if (!customer) {
            return null;
          }

          return {
            id: customer.id,
            email: customer.email,
            firstName: customer.first_name,
            lastName: customer.last_name,
            phone: customer.phone,
            importedAt: row.imported_at,
            sourceId: row.source_id,
          };
        })
        .filter(
          (
            row,
          ): row is {
            id: string;
            email: string;
            firstName: string | null;
            lastName: string | null;
            phone: string | null;
            importedAt: string;
            sourceId: string | null;
          } => Boolean(row),
        );

      const customerIds = baseRows.map((row) => row.id);
      const emails = baseRows
        .map((row) => normalizeMailchimpEmail(row.email))
        .filter(Boolean) as string[];
      const enrichment = await fetchCustomerPageEnrichment(
        tenantId,
        customerIds,
        emails,
      );

      const rows = baseRows.map((row) => {
        const normalizedEmail = normalizeMailchimpEmail(row.email);
        const suppressions = [
          ...(enrichment.suppressionsByCustomerId.get(row.id) ?? []),
          ...(normalizedEmail
            ? (enrichment.suppressionsByEmail.get(normalizedEmail) ?? [])
            : []),
        ];
        const dedupedSuppressions = Array.from(
          new Map(suppressions.map((entry) => [entry.id, entry])).values(),
        );
        const latestConsent =
          enrichment.latestConsentByCustomerId.get(row.id) ?? null;

        return {
          ...row,
          segments: enrichment.segmentsByCustomerId.get(row.id) ?? [],
          tags: enrichment.tagsByCustomerId.get(row.id) ?? [],
          latestConsent: latestConsent
            ? {
                ...latestConsent,
                email: row.email,
              }
            : null,
          activeSuppression: dedupedSuppressions[0] ?? null,
          allSuppressions: dedupedSuppressions,
        } satisfies MailchimpImportedCustomerRow;
      });

      return {
        rows,
        pagination: createPagination(options.page, count ?? 0),
      } satisfies MailchimpImportedCustomerState;
    },
    enabled: Boolean(tenantId),
    staleTime: QUERY_STALE_TIME,
  });
}

export function useMailchimpImportedSegments(options?: { enabled?: boolean }) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: ["mailchimp-imported-segments", tenantId],
    queryFn: async () => {
      if (!tenantId) {
        return [] as MailchimpImportedSegmentRow[];
      }

      const [
        { data: segments, error: segmentError },
        { data: artifacts, error: artifactError },
      ] = await Promise.all([
        supabase
          .from("crm_segments")
          .select("id, name, created_at")
          .eq("tenant_id", tenantId)
          .eq("source", "mailchimp")
          .order("name", { ascending: true }),
        supabase
          .from("provider_artifacts")
          .select("artifact_type, external_id, name, data")
          .eq("tenant_id", tenantId)
          .eq("provider", "mailchimp")
          .in("artifact_type", ["list", "segment"]),
      ]);

      if (segmentError) {
        throw segmentError;
      }

      if (artifactError) {
        throw artifactError;
      }

      const segmentRows = (segments ?? []) as Array<
        Pick<SegmentRow, "id" | "name" | "created_at">
      >;
      const artifactRows = (artifacts ?? []) as SegmentArtifactRow[];
      const artifactLookup = buildMailchimpSegmentArtifactLookup(artifactRows);

      const liveCounts = await Promise.all(
        segmentRows.map(async (segment) => {
          const { count, error } = await supabase
            .from("customer_segments")
            .select("id", { count: "exact", head: true })
            .eq("segment_id", segment.id);

          if (error) {
            throw error;
          }

          return [segment.id, count ?? 0] as const;
        }),
      );

      const liveCountMap = new Map(liveCounts);

      return segmentRows.map((segment) => {
        const artifactMetadata = artifactLookup.get(segment.name) ?? {
          sourceId: null,
          parentListId: null,
          parentListName: null,
        };

        return {
          id: segment.id,
          name: segment.name,
          sourceId: artifactMetadata.sourceId,
          memberCount: liveCountMap.get(segment.id) ?? 0,
          createdAt: segment.created_at,
          parentListId: artifactMetadata.parentListId,
          parentListName: artifactMetadata.parentListName,
        } satisfies MailchimpImportedSegmentRow;
      });
    },
    enabled: Boolean(tenantId) && (options?.enabled ?? true),
    staleTime: QUERY_STALE_TIME,
  });
}

export function useMailchimpSegmentMembersPreview(
  segmentId: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["mailchimp-segment-members-preview", segmentId],
    queryFn: async () => {
      if (!segmentId) {
        return [] as string[];
      }

      const { data, error } = await supabase
        .from("customer_segments")
        .select("customer_id, crm_customers!inner(email)")
        .eq("segment_id", segmentId)
        .order("customer_id", { ascending: true })
        .limit(10);

      if (error) {
        throw error;
      }

      return ((data ?? []) as SegmentMemberPreviewJoinRow[])
        .map((row) => getRelatedRow(row.crm_customers)?.email ?? null)
        .filter((value): value is string => Boolean(value));
    },
    enabled: Boolean(segmentId) && (options?.enabled ?? true),
    staleTime: QUERY_STALE_TIME,
  });
}

export function useMailchimpImportedTags(options?: { enabled?: boolean }) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: ["mailchimp-imported-tags", tenantId],
    queryFn: async () => {
      if (!tenantId) {
        return [] as MailchimpImportedTagRow[];
      }

      return fetchMailchimpTagRows(tenantId);
    },
    enabled: Boolean(tenantId) && (options?.enabled ?? true),
    staleTime: QUERY_STALE_TIME,
  });
}

export function useMailchimpImportedCompliance(options?: {
  enabled?: boolean;
}) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: ["mailchimp-imported-compliance", tenantId],
    queryFn: async () => {
      if (!tenantId) {
        return {
          consentRows: [],
          suppressionRows: [],
          consentSummaryCards: [],
          activeConsentRecords: 0,
          activeSuppressions: 0,
        } satisfies MailchimpImportedComplianceData;
      }

      return fetchMailchimpComplianceData(tenantId);
    },
    enabled: Boolean(tenantId) && (options?.enabled ?? true),
    staleTime: QUERY_STALE_TIME,
  });
}

export function useMailchimpCompliancePage(
  rows: MailchimpConsentRecord[] | MailchimpSuppressionRecord[],
  page: number,
) {
  return useMemo(() => {
    return {
      rows: paginateRows(rows, page, COMPLIANCE_PAGE_SIZE),
      pagination: createCompliancePagination(page, rows.length),
    };
  }, [page, rows]);
}
