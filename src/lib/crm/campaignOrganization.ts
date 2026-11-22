import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
type OrganizationDatabase = Omit<Database,'public'> & {public: Omit<Database['public'],'Tables'|'Functions'> & {
 Tables: Database['public']['Tables'] & {
      campaign_groups: {
        Row: { id: string; tenant_id: string; name: string; colour: string; };
        Insert: { id?: string; tenant_id: string; name: string; colour?: string; };
        Update: { id?: string; tenant_id?: string; name?: string; colour?: string; };
        Relationships: [];
      };

      campaign_group_memberships: {
        Row: { campaign_id: string; tenant_id: string; group_id: string; };
        Insert: { campaign_id: string; tenant_id: string; group_id: string; };
        Update: { campaign_id?: string; tenant_id?: string; group_id?: string; };
        Relationships: [];
      };

      campaign_colours: {
        Row: { campaign_id: string; tenant_id: string; colour: string; };
        Insert: { campaign_id: string; tenant_id: string; colour: string; };
        Update: { campaign_id?: string; tenant_id?: string; colour?: string; };
        Relationships: [];
      };

 };
 Functions: Database['public']['Functions'] & {reschedule_campaign:{Args:{p_campaign_id:string;p_expected_updated_at:string;p_scheduled_at:string};Returns:undefined}};
}};
export const campaignOrganizationClient = supabase as SupabaseClient<OrganizationDatabase>;

export function useCampaignOrganization(tenantId?: string) {
  const client = useQueryClient();
  const queryKey = ['campaign-organization', tenantId];
  const query = useQuery({queryKey, enabled: !!tenantId, queryFn: async () => {
    const [groups, memberships, colours] = await Promise.all([
      campaignOrganizationClient.from('campaign_groups').select('*').eq('tenant_id', tenantId!).order('name'),
      campaignOrganizationClient.from('campaign_group_memberships').select('*').eq('tenant_id', tenantId!),
      campaignOrganizationClient.from('campaign_colours').select('*').eq('tenant_id', tenantId!),
    ]);
    for (const result of [groups, memberships, colours]) if (result.error) throw result.error;
    return {groups:groups.data ?? [],memberships:memberships.data ?? [],colours:colours.data ?? []};
  }});
  const mutation = useMutation({mutationFn: async (action: {type:'group'; name:string; colour:string; id?:string} | {type:'membership'; campaignId:string; groupId:string; selected:boolean} | {type:'colour';campaignId:string;colour:string} | {type:'deleteGroup';id:string}) => {
    if (!tenantId) throw new Error('Choose a company first.');
    let result;
    if (action.type === 'group') result = action.id ? await campaignOrganizationClient.from('campaign_groups').update({name:action.name.trim(),colour:action.colour}).eq('tenant_id',tenantId).eq('id',action.id) : await campaignOrganizationClient.from('campaign_groups').insert({tenant_id:tenantId,name:action.name.trim(),colour:action.colour});
    else if (action.type === 'deleteGroup') result = await campaignOrganizationClient.from('campaign_groups').delete().eq('tenant_id',tenantId).eq('id',action.id);
    else if (action.type === 'colour') result = await campaignOrganizationClient.from('campaign_colours').upsert({tenant_id:tenantId,campaign_id:action.campaignId,colour:action.colour});
    else result = action.selected ? await campaignOrganizationClient.from('campaign_group_memberships').upsert({tenant_id:tenantId,campaign_id:action.campaignId,group_id:action.groupId}) : await campaignOrganizationClient.from('campaign_group_memberships').delete().eq('tenant_id',tenantId).eq('campaign_id',action.campaignId).eq('group_id',action.groupId);
    if (result.error) throw result.error;
  },onSuccess: () => client.invalidateQueries({queryKey})});
  return {...query, mutation};
}
