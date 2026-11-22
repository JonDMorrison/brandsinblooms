import Button from '@mui/joy/Button';
import Sheet from '@mui/joy/Sheet';
import Stack from '@mui/joy/Stack';
import Typography from '@mui/joy/Typography';
import type {NativeRewardBalance} from '../../../../supabase/functions/_shared/nativeRewardBalances';

const reasons: Record<string,string> = {
 membership_or_programme_requires_review:'The programme or membership needs review.',
 customer_not_linked:'This customer has no verified POS identity link.',
 activation_or_currency_unavailable:'The mapped POS programme or currency is unavailable.',
 membership_not_enrolled:'No matching POS reward enrollment was found.',
};
export function NativeRewardBalanceList({balances,loading=false,error=null,onRefresh}: {
 balances: NativeRewardBalance[]; loading?: boolean; error?: string|null; onRefresh?:()=>void;
}) {
 if (!balances.length && !loading && !error) return null;
 return <Sheet variant="outlined" sx={{borderRadius:'xl',p:2}}><Stack spacing={1.5}>
  <Typography level="title-md">BloomPOS reward balances</Typography>
  <Typography level="body-sm">Available rewards reported by BloomPOS, excluding pending reservations and expired rewards.</Typography>
  {error?<Typography color="warning">{error} A missing balance is not zero.</Typography>:null}
  {balances.map(balance=><Stack key={balance.mappingId} spacing={0.5}>
   <Typography level="title-sm">{balance.programName}</Typography>
   <Typography level="title-lg">{balance.status==='available' && balance.availableMinor!==null
    ? new Intl.NumberFormat(undefined,{style:'currency',currency:balance.currency}).format(balance.availableMinor/100)
    : 'Unavailable'}</Typography>
   <Typography level="body-xs">Authority: BloomPOS · {balance.currency}</Typography>
   {balance.observedAt?<Typography level="body-xs">Checked {new Date(balance.observedAt).toLocaleString()}</Typography>:null}
   {balance.reason?<Typography level="body-sm" color="warning">{reasons[balance.reason]??'The POS balance could not be verified. Try again later.'}</Typography>:null}
  </Stack>)}
  {onRefresh?<Button size="sm" variant="outlined" loading={loading} onClick={onRefresh}>Refresh POS balances</Button>:null}
 </Stack></Sheet>;
}
