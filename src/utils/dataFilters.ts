/**
 * Unified data filtering utilities for consistent tenant/user filtering across the app
 */

export interface FilterConfig {
  userId: string;
  tenantId?: string;
  isDeveloper?: boolean;
}

/**
 * Creates a standardized campaign query filter
 */
export const createCampaignFilter = (supabase: any, config: FilterConfig) => {
  let query = supabase.from('campaigns').select('*');
  
  if (config.tenantId) {
    query = query.eq('tenant_id', config.tenantId);
  } else {
    query = query.eq('user_id', config.userId);
  }
  
  return query;
};

/**
 * Creates a standardized content tasks query filter
 */
export const createContentTasksFilter = (supabase: any, config: FilterConfig) => {
  // Include all relevant statuses to ensure plan content is always visible
  const statusFilter = [
    'planned', 
    'review', 
    'approved', 
    'scheduled', 
    'published', 
    'generated',
    'pending',
    'draft',
    'needs_review',
    'in_progress',
    'failed' // Include failed to ensure SMS and other tasks remain visible
  ];
  if (config.isDeveloper) {
    statusFilter.push('preview');
  }

  let query = supabase
    .from('content_tasks')
    .select(`
      *,
      campaigns (
        title,
        tenant_id,
        user_id,
        source
      ),
      holidays (
        holiday_name,
        holiday_date
      )
    `)
    .in('status', statusFilter)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (config.tenantId) {
    query = query.eq('tenant_id', config.tenantId);
  } else {
    query = query.eq('user_id', config.userId);
  }

  return query;
};

/**
 * Security filter to double-check ownership of campaigns
 */
export const securityFilterCampaigns = (campaigns: any[], config: FilterConfig) => {
  return campaigns.filter(campaign => {
    if (config.tenantId) {
      return campaign.tenant_id === config.tenantId;
    } else {
      return campaign.user_id === config.userId;
    }
  });
};

/**
 * Security filter to double-check ownership of content tasks
 */
export const securityFilterTasks = (tasks: any[], config: FilterConfig) => {
  return tasks.filter(task => {
    if (config.tenantId) {
      return task.campaigns?.tenant_id === config.tenantId || task.tenant_id === config.tenantId;
    } else {
      return task.campaigns?.user_id === config.userId || task.user_id === config.userId;
    }
  });
};

/**
 * Deduplicates content tasks by ID to prevent duplicate rendering
 */
export const deduplicateById = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set();
  return items.filter(item => {
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
  const customCampaigns = campaigns.filter(c => {
    if (c.source !== 'quick_action') return false;
    
    if (config.tenantId) {
      return c.tenant_id === config.tenantId;
    } else {
      return c.user_id === config.userId;
    }
  });
  
  return deduplicateById(customCampaigns);
};

/**
 * Filters tasks to only include those from custom campaigns
 */
export const getCustomCampaignTasks = (tasks: any[], campaigns: any[], config: FilterConfig) => {
  const customCampaignIds = new Set(campaigns
    .filter(c => c.source === 'quick_action')
    .map(c => c.id)
  );
  
  const customTasks = tasks.filter(task => {
    // Must be from a custom campaign
    if (!customCampaignIds.has(task.campaign_id)) return false;
    
    // Apply ownership security check
    if (config.tenantId) {
      return task.campaigns?.tenant_id === config.tenantId || task.tenant_id === config.tenantId;
    } else {
      return task.campaigns?.user_id === config.userId || task.user_id === config.userId;
    }
  });
  
  return deduplicateById(customTasks);
};

/**
 * Filters tasks to exclude those from custom campaigns (for system/weekly content)
 */
export const getSystemCampaignTasks = (tasks: any[], campaigns: any[], config: FilterConfig) => {
  const customCampaignIds = new Set(campaigns
    .filter(c => c.source === 'quick_action')
    .map(c => c.id)
  );
  
  const systemTasks = tasks.filter(task => {
    // Exclude custom campaign tasks
    if (customCampaignIds.has(task.campaign_id)) return false;
    
    // Apply ownership security check
    if (config.tenantId) {
      return task.campaigns?.tenant_id === config.tenantId || task.tenant_id === config.tenantId;
    } else {
      return task.campaigns?.user_id === config.userId || task.user_id === config.userId;
    }
  });
  
  return deduplicateById(systemTasks);
};

/**
 * Filters approved tasks for ready-to-post sections
 */
export const getApprovedTasks = (tasks: any[], config: FilterConfig) => {
  const approvedTasks = tasks.filter(task => task.status === 'approved');
  const securityChecked = securityFilterTasks(approvedTasks, config);
  return deduplicateById(securityChecked);
};