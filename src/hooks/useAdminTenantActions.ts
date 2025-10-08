import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/contexts/AdminContext';
import { toast } from 'sonner';

export const useAdminTenantActions = () => {
  const { activeTenantId } = useAdmin();

  const callAdminFunction = async (action: string, data: any) => {
    if (!activeTenantId) {
      toast.error('Please select a tenant first');
      return { error: 'No tenant selected' };
    }

    try {
      const { data: result, error } = await supabase.functions.invoke('admin-manage-tenant', {
        body: {
          action,
          tenantId: activeTenantId,
          data
        }
      });

      if (error) throw error;
      return result;
    } catch (error: any) {
      console.error('Admin action error:', error);
      toast.error(error.message || 'Admin action failed');
      return { error: error.message };
    }
  };

  const importCustomers = async (customers: any[]) => {
    toast.loading('Importing customers...');
    const result = await callAdminFunction('import_customers', { customers });
    
    if (result.error) {
      toast.dismiss();
      toast.error('Failed to import customers');
      return result;
    }

    toast.dismiss();
    toast.success(`Imported ${result.imported} customers successfully`);
    return result;
  };

  const updateTenantConfig = async (config: any) => {
    toast.loading('Updating tenant configuration...');
    const result = await callAdminFunction('update_tenant_config', { config });
    
    if (result.error) {
      toast.dismiss();
      toast.error('Failed to update configuration');
      return result;
    }

    toast.dismiss();
    toast.success('Tenant configuration updated');
    return result;
  };

  const createCampaign = async (campaign: any) => {
    toast.loading('Creating campaign...');
    const result = await callAdminFunction('create_campaign', { campaign });
    
    if (result.error) {
      toast.dismiss();
      toast.error('Failed to create campaign');
      return result;
    }

    toast.dismiss();
    toast.success('Campaign created successfully');
    return result;
  };

  const uploadMedia = async (file: File, bucket: string = 'media-mms') => {
    toast.loading('Uploading media...');
    
    // Convert file to base64
    const reader = new FileReader();
    const fileData = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const result = await callAdminFunction('upload_media', {
      fileName: file.name,
      fileData,
      bucket
    });
    
    if (result.error) {
      toast.dismiss();
      toast.error('Failed to upload media');
      return result;
    }

    toast.dismiss();
    toast.success('Media uploaded successfully');
    return result;
  };

  return {
    importCustomers,
    updateTenantConfig,
    createCampaign,
    uploadMedia
  };
};