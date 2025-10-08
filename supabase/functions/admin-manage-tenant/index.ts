import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPrelight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return corsJsonResponse({ error: 'No authorization header' }, { status: 401 });
    }

    // Verify the admin making the request
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return corsJsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is master admin
    const { data: isMasterAdmin } = await supabase.rpc('is_master_admin', { _user_id: user.id });
    
    if (!isMasterAdmin) {
      console.error('Non-admin user attempted admin action:', user.id);
      return corsJsonResponse({ error: 'Access denied. Master admin required.' }, { status: 403 });
    }

    const { action, tenantId, data } = await req.json();

    console.log('Admin action:', { action, tenantId, adminId: user.id });

    switch (action) {
      case 'import_customers': {
        // Import customers for a tenant
        const { customers } = data;
        
        const customersToInsert = customers.map((customer: any) => ({
          tenant_id: tenantId,
          user_id: customer.user_id || user.id,
          email: customer.email,
          first_name: customer.first_name,
          last_name: customer.last_name,
          phone: customer.phone,
          sms_opt_in: customer.sms_opt_in || false,
          custom_fields: customer.custom_fields || {}
        }));

        const { data: inserted, error: insertError } = await supabase
          .from('crm_customers')
          .insert(customersToInsert)
          .select();

        if (insertError) {
          console.error('Error importing customers:', insertError);
          throw insertError;
        }

        // Log the action
        await supabase.rpc('log_admin_action', {
          p_action_type: 'import_customers',
          p_target_tenant_id: tenantId,
          p_action_details: { 
            customer_count: customers.length,
            imported_count: inserted?.length || 0 
          }
        });

        return corsJsonResponse({
          success: true,
          imported: inserted?.length || 0,
          data: inserted
        });
      }

      case 'update_tenant_config': {
        // Update tenant configuration
        const { config } = data;
        
        const { error: updateError } = await supabase
          .from('tenants')
          .update(config)
          .eq('id', tenantId);

        if (updateError) {
          console.error('Error updating tenant config:', updateError);
          throw updateError;
        }

        // Log the action
        await supabase.rpc('log_admin_action', {
          p_action_type: 'update_tenant_config',
          p_target_tenant_id: tenantId,
          p_action_details: config
        });

        return corsJsonResponse({
          success: true,
          message: 'Tenant configuration updated'
        });
      }

      case 'create_campaign': {
        // Create a campaign on behalf of tenant
        const { campaign } = data;
        
        const { data: created, error: createError } = await supabase
          .from('crm_campaigns')
          .insert({
            ...campaign,
            tenant_id: tenantId,
            user_id: campaign.user_id || user.id
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating campaign:', createError);
          throw createError;
        }

        // Log the action
        await supabase.rpc('log_admin_action', {
          p_action_type: 'create_campaign',
          p_target_tenant_id: tenantId,
          p_action_details: { campaign_id: created.id, campaign_name: campaign.name }
        });

        return corsJsonResponse({
          success: true,
          campaign: created
        });
      }

      case 'upload_media': {
        // Upload media files on behalf of tenant
        const { fileName, fileData, bucket } = data;
        
        const filePath = `${tenantId}/${Date.now()}-${fileName}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucket || 'media-mms')
          .upload(filePath, fileData);

        if (uploadError) {
          console.error('Error uploading media:', uploadError);
          throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from(bucket || 'media-mms')
          .getPublicUrl(filePath);

        // Log the action
        await supabase.rpc('log_admin_action', {
          p_action_type: 'upload_media',
          p_target_tenant_id: tenantId,
          p_action_details: { file_name: fileName, file_path: filePath }
        });

        return corsJsonResponse({
          success: true,
          url: publicUrl,
          path: filePath
        });
      }

      default:
        return corsJsonResponse({ error: 'Unknown action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Admin management error:', error);
    return corsJsonResponse({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});