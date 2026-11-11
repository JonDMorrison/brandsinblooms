import {Sheet,Stack,Typography} from '@mui/joy';
export function ImportedCustomerSummary({fields}: {fields: unknown}) {
  if(!fields || typeof fields!=='object' || Array.isArray(fields)) return null;
  const data=fields as Record<string,unknown>;
  if(typeof data.ideal_customer_code!=='string' || data.ideal_import_source===undefined) return null;
  const report=data.ideal_reported_ytd as {start?:unknown;end?:unknown;spend?:unknown;transactions?:unknown}|undefined;
  const valid=report && typeof report.start==='string' && typeof report.end==='string' && typeof report.spend==='number' && Number.isFinite(report.spend) && typeof report.transactions==='number';
  return <Sheet variant="outlined" sx={{p:2.5,borderRadius:'lg'}}><Stack spacing={0.75}>
    <Typography level="title-lg">Imported IdealPOS history</Typography>
    <Typography level="body-sm">Customer code {data.ideal_customer_code}{typeof data.ideal_customer_type==='string' && data.ideal_customer_type ? ` · IdealPOS type ${data.ideal_customer_type}` : ''}</Typography>
    {valid ? <>
      <Typography level="body-md">{new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(report.spend as number)} reported spending · {String(report.transactions)} reported transactions</Typography>
      <Typography level="body-sm">{String(report.start)} through {String(report.end)}. This is the spending report total, not lifetime value or a list of dated receipts.</Typography>
    </> : <Typography level="body-sm">A source customer profile is available. No period spending total has been inferred from missing records.</Typography>}
    {data.ideal_source_identity_review===true && <Typography level="body-sm">This code appears in purchase reports but was not found in the customer master. Its identity is preserved for review.</Typography>}
    {data.ideal_contact_review===true && <Typography level="body-sm">Source contact details need review. Separate customer codes have not been merged using a shared or invalid email.</Typography>}
    <Typography level="body-xs">Importing a profile does not establish its first purchase date, membership enrolment, or marketing consent.</Typography>
  </Stack></Sheet>;
}
