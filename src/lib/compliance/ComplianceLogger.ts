import { supabase } from '@/integrations/supabase/client';

export interface ComplianceLogEntry {
  event_type: 'deferred_send' | 'footer_inserted' | 'opt_out' | 'opt_in' | 'help_request' | 'blocked_send';
  msisdn: string;
  campaign_id?: string;
  automation_id?: string;
  message_content?: string;
  meta?: Record<string, any>;
}

export class ComplianceLogger {
  static async log(entry: ComplianceLogEntry): Promise<void> {
    try {
      // Get current user info for tenant/user context
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('Cannot log compliance event: no authenticated user');
        return;
      }

      // Get user's tenant info
      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!userRecord?.tenant_id) {
        console.warn('Cannot log compliance event: no tenant found for user');
        return;
      }

      const { error } = await supabase
        .from('compliance_logs')
        .insert({
          tenant_id: userRecord.tenant_id,
          user_id: user.id,
          event_type: entry.event_type,
          msisdn: entry.msisdn,
          campaign_id: entry.campaign_id,
          automation_id: entry.automation_id,
          message_content: entry.message_content,
          meta: entry.meta || {}
        });

      if (error) {
        console.error('Failed to log compliance event:', error);
      }
    } catch (error) {
      console.error('Error logging compliance event:', error);
    }
  }

  static async getComplianceLogs(
    tenantId: string, 
    filters?: {
      eventType?: string;
      campaignId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ) {
    let query = supabase
      .from('compliance_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (filters?.eventType) {
      query = query.eq('event_type', filters.eventType);
    }

    if (filters?.campaignId) {
      query = query.eq('campaign_id', filters.campaignId);
    }

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch compliance logs:', error);
      return [];
    }

    return data || [];
  }

  static async exportComplianceLogs(
    tenantId: string,
    filters?: Parameters<typeof this.getComplianceLogs>[1]
  ): Promise<string> {
    const logs = await this.getComplianceLogs(tenantId, filters);
    
    if (logs.length === 0) {
      return 'event_type,msisdn,campaign_id,message_content,timestamp\n';
    }

    const headers = ['event_type', 'msisdn', 'campaign_id', 'message_content', 'created_at'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => [
        log.event_type,
        log.msisdn,
        log.campaign_id || '',
        (log.message_content || '').replace(/"/g, '""'),
        log.created_at
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    return csvContent;
  }
}