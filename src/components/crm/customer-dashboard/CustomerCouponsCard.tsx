import {Stack,Typography,Skeleton,Divider} from '@mui/joy';
import {JoyCard,JoyCardContent,JoyCardHeader} from '@/components/joy/JoyCard';
import {useCustomerCoupons} from '@/hooks/useCustomerCoupons';
export function CustomerCouponsCard({tenantId,customerId}:{tenantId:string;customerId:string}){
 const query=useCustomerCoupons(tenantId,customerId);
 return <JoyCard><JoyCardHeader title="IdealPOS coupon history" description="Evidence from completed imports. Unknown history is not treated as an unused coupon."/><JoyCardContent>
 {query.isLoading?<Skeleton height={80}/>:query.isError?<Typography color="danger">Coupon evidence could not be loaded. No coupon state has been assumed.</Typography>:!query.data?.rows.length?<Typography level="body-sm">No accessible verified coupon history is available for this customer.</Typography>:<Stack spacing={1.5} divider={<Divider/>}>{query.data.rows.map(row=><Stack key={row.source_event_ids.join(':')} spacing={0.5}>
 <Typography level="title-sm">{row.coupon_code} · {row.state==='issued_no_known_redemption'?'Issued; redemption not known':row.state}</Typography>
 <Typography level="body-sm">{row.reason}</Typography>
 <Typography level="body-xs">Issued: {row.issued_at??'Unknown'} · Expires: {row.expires_at??'Unknown'} · Redeemed: {row.redeemed_at??'Not known'}</Typography>
 {row.transaction_ids.length>0&&<Typography level="body-xs">Recorded receipt references: {row.transaction_ids.join(', ')}. Receipt amounts and items are not inferred.</Typography>}
 <Typography level="body-xs">Source imports: {row.import_ids.join(', ')}</Typography>
 </Stack>)}</Stack>}
 <Typography level="body-xs" sx={{mt:1}}>Evidence checked: {query.data?.cutoff??'Unavailable'}.</Typography>
 <Typography level="body-xs" sx={{mt:1}}>Reminder timing is configured on an automation email node. Missing issuance or expiry, ambiguous coupon reuse and known redemption suppress reminders. Manual imports cannot reveal later POS activity.</Typography>
 </JoyCardContent></JoyCard>;
}
