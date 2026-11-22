import { useState } from 'react';
import Stack from '@mui/joy/Stack';
import Typography from '@mui/joy/Typography';
import { JoyButton } from '@/components/joy/JoyButton';
import type { POSPurchaseHealth as Health } from '@/hooks/usePOSPurchaseHealth';
export function POSPurchaseHealth({rows}:{rows:Health[]}) {
 const [reviewing,setReviewing]=useState<string|null>(null);
 return <Stack spacing={2}>{rows.map(row=><Stack key={row.connection_id} spacing={1}>
  <Typography level="title-sm">{row.connection_name}</Typography>
  <Typography level="body-sm">{row.missing_original_sales>0?`${row.missing_original_sales} original sales are missing from received purchase history.`:'No missing original sales in received purchase history.'}</Typography>
  {row.missing_original_sales>0?<>
   <Typography level="body-sm">{row.orphan_returns} returns and {row.orphan_voids} voids await their original sale. Accepted receipts do not mean purchase totals are complete.</Typography>
   <JoyButton variant="outlined" onClick={()=>setReviewing(reviewing===row.connection_id?null:row.connection_id)}>Review missing sales</JoyButton>
   {reviewing===row.connection_id?<Stack spacing={1}>
    <Typography level="body-sm">Compare these references with the original POS receipts and the approved history start date. A sale before that date needs a separately reviewed history import. This screen does not replay, dismiss or change any records.</Typography>
    <Typography level="body-xs">First 50 missing sale references:</Typography>
    {Array.isArray(row.missing_sale_references)?row.missing_sale_references.map((value,index)=>value&&typeof value==='object'&&!Array.isArray(value)?<Typography level="body-xs" key={index}>{String(value.saleReference??'')} · {String(value.eventType??'')}</Typography>:null):null}
   </Stack>:null}
  </>:null}
  {row.latest_receipt_at?<Typography level="body-xs">Latest receipt: {new Date(row.latest_receipt_at).toLocaleString()}</Typography>:null}
 </Stack>)}</Stack>;
}
