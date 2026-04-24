/**
 * Unified data filtering utilities for consistent tenant/user filtering across the app
 */

import { buildTenantUserScopeFilter } from "@/utils/tenantScope";

export interface FilterConfig {
  userId: string;
  tenantId?: string;
  isDeveloper?: boolean;
}

const hasScopedRecord = (
  record?: {
    tenant_id?: string | null;
    user_id?: string | null;
  } | null,
) => {
  if (!record) {
    return false;
  }

  return Object.values(record).some((value) => value !== undefined);
};

const matchesTenantUserScope = (
  record: { tenant_id?: string | null; user_id?: string | null },
  config: FilterConfig,
) => {
  if (config.tenantId) {
    return record.tenant_id === config.tenantId;
  }

  return !record.tenant_id && record.user_id === config.userId;
};

const matchesTaskTenantUserScope = (task: any, config: FilterConfig) => {
  if (!config.tenantId) {
    return (
      matchesTenantUserScope(task.campaigns || {}, config) ||
      matchesTenantUserScope(task.plans || {}, config) ||
      matchesTenantUserScope(task, config)
    );
  }

  const scopedRecords = [task, task?.campaigns, task?.plans].filter(
    hasScopedRecord,
  );

  if (scopedRecords.length === 0) {
    return false;
  }

  const hasConflictingTenant = scopedRecords.some(
    (record) => record.tenant_id !== config.tenantId,
  );

  if (hasConflictingTenant) {
    return false;
  }

  return scopedRecords.some((record) => record.tenant_id === config.tenantId);
};

/**
 * Creates a standardized campaign query filter
 */
export const createCampaignFilter = (supabase: any, config: FilterConfig) => {
  let query = supabase.from("campaigns").select("*");

  if (config.tenantId) {
    return query.eq("tenant_id", config.tenantId);
  }

  const filter = buildTenantUserScopeFilter({
    tenantId: config.tenantId,
    userId: config.userId,
  });

  if (filter) {
    query = query.or(filter);
  }

  return query;
};

/**
 * Creates a standardized content tasks query filter
 */
export const createContentTasksFilter = (
  supabase: any,
  config: FilterConfig,
) => {
  // Include all relevant statuses to ensure plan content is always visible
  const statusFilter = [
    "planned",
    "review",
    "approved",
    "scheduled",
    "published",
    "generated",
    "pending",
    "draft",
    "needs_review",
    "in_progress",
    "failed", // Include failed to ensure SMS and other tasks remain visible
  ];
  if (config.isDeveloper) {
    statusFilter.push("preview");
  }

  let query = supabase
    .from("content_tasks")
    .select(
      `
      *,
      campaigns (
        title,
        tenant_id,
        user_id,
        source
      ),
      plans (
        id,
        name,
        month,
        themes,
        tenant_id,
        user_id
      ),
      holidays (
        holiday_name,
        holiday_date
      )
    `,
    )
    .in("status", statusFilter)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (config.tenantId) {
    return query.eq("tenant_id", config.tenantId);
  }

  const filter = buildTenantUserScopeFilter({
    tenantId: config.tenantId,
    userId: config.userId,
  });

  if (filter) {
    query = query.or(filter);
  }

  return query;
};

/**
 * Security filter to double-check ownership of campaigns
 */
export const securityFilterCampaigns = (
  campaigns: any[],
  config: FilterConfig,
) => {
  return campaigns.filter((campaign) => {
    return matchesTenantUserScope(campaign, config);
  });
};

/**
 * Security filter to double-check ownership of content tasks
 * Handles both campaign-based and plan-based tasks
 */
export const securityFilterTasks = (tasks: any[], config: FilterConfig) => {
  return tasks.filter((task) => {
    return matchesTaskTenantUserScope(task, config);
  });
};

/**
 * Deduplicates content tasks by ID to prevent duplicate rendering
 */
export const deduplicateById = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
};

/**
 * Filters and deduplicates custom campaigns (source: 'quick_action')
 */
export const getCustomCampaigns = (campaigns: any[], config: FilterConfig) => {
  const customCampaigns = campaigns.filter((c) => {
    if (c.source !== "quick_action") return false;

    return matchesTenantUserScope(c, config);
  });

  return deduplicateById(customCampaigns);
};

/**
 * Filters tasks to only include those from custom campaigns
 */
export const getCustomCampaignTasks = (
  tasks: any[],
  campaigns: any[],
  config: FilterConfig,
) => {
  const customCampaignIds = new Set(
    campaigns.filter((c) => c.source === "quick_action").map((c) => c.id),
  );

  const customTasks = tasks.filter((task) => {
    // Must be from a custom campaign
    if (!customCampaignIds.has(task.campaign_id)) return false;

    // Apply ownership security check
    return matchesTaskTenantUserScope(task, config);
  });

  return deduplicateById(customTasks);
};

/**
 * Filters tasks to exclude those from custom campaigns (for system/weekly content)
 * Includes plan-based tasks as they are considered system content
 */
export const getSystemCampaignTasks = (
  tasks: any[],
  campaigns: any[],
  config: FilterConfig,
) => {
  const customCampaignIds = new Set(
    campaigns.filter((c) => c.source === "quick_action").map((c) => c.id),
  );

  const systemTasks = tasks.filter((task) => {
    // Exclude custom campaign tasks
    if (customCampaignIds.has(task.campaign_id)) return false;

    // Apply ownership security check (include plan-based tasks)
    return matchesTaskTenantUserScope(task, config);
  });

  return deduplicateById(systemTasks);
};

/**
 * Filters approved tasks for ready-to-post sections
 */
export const getApprovedTasks = (tasks: any[], config: FilterConfig) => {
  const approvedTasks = tasks.filter((task) => task.status === "approved");
  const securityChecked = securityFilterTasks(approvedTasks, config);
  return deduplicateById(securityChecked);
};
