import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ComplianceLogger } from '@/lib/compliance/ComplianceLogger';

export const useCompliance = () => {
  const [complianceLogs, setComplianceLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async (filters?: any) => {
    setLoading(true);
    try {
      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (userRecord?.tenant_id) {
        const logs = await ComplianceLogger.getComplianceLogs(userRecord.tenant_id, filters);
        setComplianceLogs(logs);
      }
    } catch (error) {
      console.error('Failed to fetch compliance logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = async (filters?: any) => {
    try {
      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (userRecord?.tenant_id) {
        const csvContent = await ComplianceLogger.exportComplianceLogs(userRecord.tenant_id, filters);
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compliance-logs-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return {
    complianceLogs,
    loading,
    fetchLogs,
    exportLogs
  };
};