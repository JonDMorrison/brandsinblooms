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
 Functions: Database['public']['Functions'] & {
  reschedule_campaign:{Args:{p_campaign_id:string;p_expected_updated_at:string;p_scheduled_at:string};Returns:undefined};
  create_campaign_group_with_membership:{Args:{p_tenant_id:string;p_campaign_id:string;p_name:string;p_colour:string};Returns:OrganizationDatabase['public']['Tables']['campaign_groups']['Row']};
 };
}};
export const campaignOrganizationClient = supabase as SupabaseClient<OrganizationDatabase>;

export type CampaignGroup = OrganizationDatabase['public']['Tables']['campaign_groups']['Row'];
export type CampaignGroupMembership = OrganizationDatabase['public']['Tables']['campaign_group_memberships']['Row'];
export type CampaignColour = OrganizationDatabase['public']['Tables']['campaign_colours']['Row'];
export interface CampaignOrganizationData {
  groups: CampaignGroup[];
  memberships: CampaignGroupMembership[];
  colours: CampaignColour[];
}

export type CampaignOrganizationAction =
  /** Creates a group and, when campaignId is given, puts the campaign in it in one call. */
  | {type:'group'; name:string; colour:string; id?:string; campaignId?:string}
  | {type:'membership'; campaignId:string; groupId:string; selected:boolean}
  | {type:'colour'; campaignId:string; colour:string}
  | {type:'deleteGroup'; id:string};

type CampaignOrganizationResult =
  | {type:'group'; group:CampaignGroup; membership:CampaignGroupMembership|null}
  | {type:'membership'; membership:CampaignGroupMembership; selected:boolean}
  | {type:'colour'; colour:CampaignColour}
  | {type:'deleteGroup'; id:string};

export const campaignOrganizationQueryKey = (tenantId?: string) => ['campaign-organization', tenantId] as const;

const byName = (a: CampaignGroup, b: CampaignGroup) => a.name.localeCompare(b.name);

/** Applies a saved write to the cached organization data, so every reader updates without a refetch. */
export function applyCampaignOrganizationResult(data: CampaignOrganizationData, result: CampaignOrganizationResult): CampaignOrganizationData {
  switch (result.type) {
    case 'group': {
      const groups = [...data.groups.filter(g => g.id !== result.group.id), result.group].sort(byName);
      const membership = result.membership;
      const memberships = membership && !data.memberships.some(m => m.campaign_id === membership.campaign_id && m.group_id === membership.group_id)
        ? [...data.memberships, membership]
        : data.memberships;
      return {...data, groups, memberships};
    }
    case 'membership': {
      const {membership, selected} = result;
      const rest = data.memberships.filter(m => !(m.campaign_id === membership.campaign_id && m.group_id === membership.group_id));
      return {...data, memberships: selected ? [...rest, membership] : rest};
    }
    case 'colour':
      return {...data, colours: [...data.colours.filter(c => c.campaign_id !== result.colour.campaign_id), result.colour]};
    case 'deleteGroup':
      return {...data, groups: data.groups.filter(g => g.id !== result.id), memberships: data.memberships.filter(m => m.group_id !== result.id)};
  }
}

async function runAction(tenantId: string, action: CampaignOrganizationAction): Promise<CampaignOrganizationResult> {
  if (action.type === 'group') {
    const name = action.name.trim();
    if (action.id) {
      const {data, error} = await campaignOrganizationClient.from('campaign_groups').update({name, colour:action.colour}).eq('tenant_id',tenantId).eq('id',action.id).select('*').single();
      if (error) throw error;
      return {type:'group', group:data, membership:null};
    }
    if (action.campaignId) {
      const {data, error} = await campaignOrganizationClient.rpc('create_campaign_group_with_membership',{p_tenant_id:tenantId,p_campaign_id:action.campaignId,p_name:name,p_colour:action.colour});
      if (error) throw error;
      if (!data?.id) throw new Error('The group was not saved. Try again.');
      return {type:'group', group:data, membership:{campaign_id:action.campaignId, tenant_id:tenantId, group_id:data.id}};
    }
    const {data, error} = await campaignOrganizationClient.from('campaign_groups').insert({tenant_id:tenantId,name,colour:action.colour}).select('*').single();
    if (error) throw error;
    return {type:'group', group:data, membership:null};
  }
  if (action.type === 'deleteGroup') {
    const {error} = await campaignOrganizationClient.from('campaign_groups').delete().eq('tenant_id',tenantId).eq('id',action.id);
    if (error) throw error;
    return {type:'deleteGroup', id:action.id};
  }
  if (action.type === 'colour') {
    const {data, error} = await campaignOrganizationClient.from('campaign_colours').upsert({tenant_id:tenantId,campaign_id:action.campaignId,colour:action.colour}).select('*').single();
    if (error) throw error;
    return {type:'colour', colour:data};
  }
  const membership = {tenant_id:tenantId,campaign_id:action.campaignId,group_id:action.groupId};
  if (action.selected) {
    const {data, error} = await campaignOrganizationClient.from('campaign_group_memberships').upsert(membership).select('*').single();
    if (error) throw error;
    return {type:'membership', membership:data, selected:true};
  }
  // Removing a campaign from a group deletes the membership only; the group stays.
  const {error} = await campaignOrganizationClient.from('campaign_group_memberships').delete().eq('tenant_id',tenantId).eq('campaign_id',action.campaignId).eq('group_id',action.groupId);
  if (error) throw error;
  return {type:'membership', membership, selected:false};
}

export function useCampaignOrganization(tenantId?: string) {
  const client = useQueryClient();
  const queryKey = campaignOrganizationQueryKey(tenantId);
  const query = useQuery({queryKey, enabled: !!tenantId, queryFn: async (): Promise<CampaignOrganizationData> => {
    const [groups, memberships, colours] = await Promise.all([
      campaignOrganizationClient.from('campaign_groups').select('*').eq('tenant_id', tenantId!).order('name'),
      campaignOrganizationClient.from('campaign_group_memberships').select('*').eq('tenant_id', tenantId!),
      campaignOrganizationClient.from('campaign_colours').select('*').eq('tenant_id', tenantId!),
    ]);
    for (const result of [groups, memberships, colours]) if (result.error) throw result.error;
    return {groups:groups.data ?? [],memberships:memberships.data ?? [],colours:colours.data ?? []};
  }});
  const mutation = useMutation({
    mutationFn: async (action: CampaignOrganizationAction) => {
      if (!tenantId) throw new Error('Choose a company first.');
      return runAction(tenantId, action);
    },
    onSuccess: (result) => {
      client.setQueryData<CampaignOrganizationData>(queryKey, current => current ? applyCampaignOrganizationResult(current, result) : current);
    },
    // A failed write may leave the cache behind the database; read it again.
    onError: () => client.invalidateQueries({queryKey}),
  });
  return {...query, mutation};
}
