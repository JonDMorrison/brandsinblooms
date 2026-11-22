import * as React from 'react';
import { Stack, Button, Typography, Checkbox, Input, Box } from '@mui/joy';
import { useUserRole } from '@/hooks/useUserRole';
import { useTenant } from '@/hooks/useTenant';
import { useCampaignOrganization } from '@/lib/crm/campaignOrganization';

export function CampaignOrganization({campaignId, disabled = false}: {campaignId?:string|null; disabled?:boolean}) {
 const {tenant} = useTenant();
 const {data, error, mutation} = useCampaignOrganization(tenant?.id);
 const [name,setName] = React.useState('');
 const [colour,setColour] = React.useState('#496A51');
 const [editing,setEditing] = React.useState<string|undefined>();
 const [confirmDelete,setConfirmDelete] = React.useState<string|null>(null);
 const {hasPermission} = useUserRole();
 const busy = disabled || !hasPermission("campaigns.write") || mutation.isPending;
 const save = () => mutation.mutate({type:'group',name,colour,id:editing},{onSuccess:()=>{setName('');setEditing(undefined);}});
 return <Stack spacing={1.5}>
  <Typography level="title-sm">Groups & colour</Typography>
  <Typography level="body-xs">Use more than one group, such as December and Wholesale.</Typography>
  {(error || mutation.error) && <Typography color="danger">Could not save or load groups. {String((mutation.error ?? error)?.message ?? '')}</Typography>}
  {data?.groups.map(group => <Stack key={group.id} direction="row" spacing={1} alignItems="center">
   {campaignId && <Checkbox disabled={busy} checked={data.memberships.some(m=>m.campaign_id===campaignId && m.group_id===group.id)} onChange={e=>mutation.mutate({type:'membership',campaignId,groupId:group.id,selected:e.target.checked})} label={group.name} />}
   <Box sx={{width:14,height:14,bgcolor:group.colour,borderRadius:2}} />
   {!campaignId && <Typography level="body-sm">{group.name}</Typography>}
   <Button size="sm" variant="plain" disabled={busy} onClick={()=>{setEditing(group.id);setName(group.name);setColour(group.colour);}}>Rename / colour</Button>
   <Button size="sm" variant="plain" disabled={busy} onClick={()=>setConfirmDelete(group.id)}>Remove</Button>
   {confirmDelete===group.id && <Button size="sm" disabled={busy} onClick={()=>mutation.mutate({type:'deleteGroup',id:group.id},{onSuccess:()=>setConfirmDelete(null)})}>Remove group from all campaigns</Button>}
  </Stack>)}
  <Stack direction="row" spacing={1} alignItems="center">
   <Input placeholder="New group name" value={name} disabled={busy} onChange={e=>setName(e.target.value)} slotProps={{input:{maxLength:80,'aria-label':'Group name'}}} />
   <input aria-label="Group colour" type="color" value={colour} disabled={busy} onChange={e=>setColour(e.target.value)} />
   <Button disabled={busy || !name.trim()} onClick={save}>{editing ? 'Save group' : 'Add group'}</Button>
   {editing && <Button variant="plain" onClick={()=>{setEditing(undefined);setName('');}}>Cancel</Button>}
  </Stack>
  {campaignId && <Stack direction="row" spacing={1} alignItems="center"><Typography level="body-sm">Campaign colour</Typography><input aria-label="Campaign colour" type="color" disabled={busy} value={data?.colours.find(c=>c.campaign_id===campaignId)?.colour ?? '#496A51'} onChange={e=>mutation.mutate({type:'colour',campaignId,colour:e.target.value})} /></Stack>}
 </Stack>;
}
