import * as React from 'react';
import { Stack, Button, Typography, Input, Box, FormControl, FormLabel } from '@mui/joy';
import { Plus } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useTenant } from '@/hooks/useTenant';
import { useCampaignOrganization, type CampaignGroup } from '@/lib/crm/campaignOrganization';

const DEFAULT_COLOUR = '#496A51';
/** The colour picker fires on every drag step; save once it settles. */
const COLOUR_SAVE_DELAY_MS = 400;

const wrapRowSx = {minWidth: 0, maxWidth: '100%'} as const;

function Swatch({colour}: {colour: string}) {
 return <Box component="span" aria-hidden sx={{width:14,height:14,flexShrink:0,bgcolor:colour,borderRadius:'xs'}} />;
}

export function CampaignOrganization({campaignId, disabled = false, onSaved}: {
 campaignId?: string | null;
 disabled?: boolean;
 /** Called after each organization write lands, with the time it saved. */
 onSaved?: (savedAt: Date) => void;
}) {
 const {tenant} = useTenant();
 const {data, error, mutation} = useCampaignOrganization(tenant?.id);
 const [name,setName] = React.useState('');
 const [colour,setColour] = React.useState(DEFAULT_COLOUR);
 const [editing,setEditing] = React.useState<string|undefined>();
 const [confirmDelete,setConfirmDelete] = React.useState<string|null>(null);
 const {hasPermission} = useUserRole();
 const busy = disabled || !hasPermission("campaigns.write") || mutation.isPending;
 const onSavedRef = React.useRef(onSaved);
 onSavedRef.current = onSaved;
 const markSaved = React.useCallback(() => onSavedRef.current?.(new Date()), []);

 const memberIds = React.useMemo(() => new Set(
  campaignId ? (data?.memberships ?? []).filter(m => m.campaign_id === campaignId).map(m => m.group_id) : [],
 ), [campaignId, data?.memberships]);
 const groups = data?.groups ?? [];
 const memberGroups = campaignId ? groups.filter(g => memberIds.has(g.id)) : [];
 const otherGroups = campaignId ? groups.filter(g => !memberIds.has(g.id)) : [];

 const resetForm = () => { setName(''); setEditing(undefined); };
 const save = () => mutation.mutate(
  {type:'group', name, colour, id:editing, campaignId: editing ? undefined : campaignId ?? undefined},
  {onSuccess: () => { resetForm(); markSaved(); }},
 );
 const setMembership = (groupId: string, selected: boolean) => {
  if (!campaignId) return;
  mutation.mutate({type:'membership', campaignId, groupId, selected}, {onSuccess: markSaved});
 };
 const startEditing = (group: CampaignGroup) => { setEditing(group.id); setName(group.name); setColour(group.colour); };

 // Campaign colour: shown at once, saved after the picker settles.
 const savedCampaignColour = campaignId ? data?.colours.find(c => c.campaign_id === campaignId)?.colour : undefined;
 const [campaignColour, setCampaignColour] = React.useState<string | null>(null);
 const pendingColourRef = React.useRef<{campaignId: string; colour: string} | null>(null);
 const colourTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
 const mutateRef = React.useRef(mutation.mutate);
 mutateRef.current = mutation.mutate;
 const flushColour = React.useCallback(() => {
  if (colourTimerRef.current) { clearTimeout(colourTimerRef.current); colourTimerRef.current = null; }
  const pending = pendingColourRef.current;
  pendingColourRef.current = null;
  if (pending) mutateRef.current({type:'colour', ...pending}, {onSuccess: markSaved});
 }, [markSaved]);
 React.useEffect(() => () => flushColour(), [flushColour]);
 const changeCampaignColour = (next: string) => {
  if (!campaignId) return;
  setCampaignColour(next);
  pendingColourRef.current = {campaignId, colour: next};
  if (colourTimerRef.current) clearTimeout(colourTimerRef.current);
  colourTimerRef.current = setTimeout(flushColour, COLOUR_SAVE_DELAY_MS);
 };
 const shownCampaignColour = campaignColour ?? savedCampaignColour ?? DEFAULT_COLOUR;

 const groupRow = (group: CampaignGroup, actions: React.ReactNode) => (
  <Stack key={group.id} direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={wrapRowSx} data-testid="campaign-organization-group">
   <Swatch colour={group.colour} />
   <Typography level="body-md" sx={{minWidth: 0, overflowWrap: 'anywhere'}}>{group.name}</Typography>
   <Button size="sm" variant="plain" disabled={busy} onClick={() => startEditing(group)}>Rename / colour</Button>
   {actions}
  </Stack>
 );

 return <Stack spacing={1.5} sx={{minWidth: 0}}>
  <Typography level="title-sm">Groups & colour</Typography>
  <Typography level="body-xs">Use more than one group, such as December and Wholesale.</Typography>
  {(error || mutation.error) && <Typography color="danger" role="alert">Could not save or load groups. {String((mutation.error ?? error)?.message ?? '')}</Typography>}

  {campaignId ? <>
   {memberGroups.length > 0
    ? memberGroups.map(group => groupRow(group,
       <Button size="sm" variant="plain" color="neutral" disabled={busy} aria-label={`Remove from ${group.name}`} onClick={() => setMembership(group.id, false)}>Remove</Button>))
    : <Typography level="body-sm" sx={{color: 'text.secondary'}}>This campaign is not in a group yet.</Typography>}
   {otherGroups.length > 0 && <Stack spacing={0.75} sx={wrapRowSx}>
    <Typography level="body-sm" sx={{color: 'text.secondary'}}>Add to an existing group</Typography>
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={wrapRowSx}>
     {otherGroups.map(group => <Button key={group.id} size="sm" variant="outlined" color="neutral" disabled={busy}
      startDecorator={<Plus size={14} aria-hidden />} endDecorator={<Swatch colour={group.colour} />}
      aria-label={`Add to ${group.name}`} onClick={() => setMembership(group.id, true)}>{group.name}</Button>)}
    </Stack>
   </Stack>}
  </> : groups.map(group => groupRow(group, <>
   <Button size="sm" variant="plain" color="neutral" disabled={busy} onClick={() => setConfirmDelete(group.id)}>Delete group</Button>
   {confirmDelete === group.id && <Button size="sm" color="danger" disabled={busy} onClick={() => mutation.mutate({type:'deleteGroup', id:group.id}, {onSuccess: () => setConfirmDelete(null)})}>Remove group from all campaigns</Button>}
  </>))}

  <Stack direction="row" spacing={1} alignItems="flex-end" useFlexGap flexWrap="wrap" sx={wrapRowSx}>
   <FormControl sx={{minWidth: 0, flex: '1 1 180px', maxWidth: 320}}>
    <FormLabel htmlFor="campaign-organization-group-name">{editing ? 'Group name' : 'New group name'}</FormLabel>
    <Input placeholder="e.g. December" value={name} disabled={busy} onChange={e=>setName(e.target.value)} slotProps={{input:{maxLength:80,id:'campaign-organization-group-name'}}} />
   </FormControl>
   <FormControl>
    <FormLabel htmlFor="campaign-organization-group-colour">Group colour</FormLabel>
    <input id="campaign-organization-group-colour" type="color" value={colour} disabled={busy} onChange={e=>setColour(e.target.value)} style={{minHeight:44,minWidth:44}} />
   </FormControl>
   <Button disabled={busy || !name.trim()} onClick={save}>{editing ? 'Save group' : 'Add group'}</Button>
   {editing && <Button variant="plain" onClick={resetForm}>Cancel</Button>}
  </Stack>
  {campaignId && <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={wrapRowSx}>
   <Typography component="label" htmlFor="campaign-organization-campaign-colour" level="body-sm">Campaign colour</Typography>
   <input id="campaign-organization-campaign-colour" type="color" style={{minHeight:44,minWidth:44}} disabled={disabled || !hasPermission("campaigns.write")} value={shownCampaignColour} onChange={e=>changeCampaignColour(e.target.value)} onBlur={flushColour} />
  </Stack>}
 </Stack>;
}
