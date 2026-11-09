import * as React from 'react';
import { Alert, Box, Button, Checkbox, FormControl, FormLabel, Input, Option, Select, Sheet, Stack, Table, Textarea, Typography } from '@mui/joy';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAdmin } from '@/contexts/AdminContext';
import type { GrowthOrder } from '../../../../supabase/functions/_shared/customer-intelligence/customer-growth';
import { customerGrowthBreakdown, type GrowthBreakdownSettings } from '../../../../supabase/functions/_shared/customer-intelligence/customer-growth-breakdown';
import { localDate } from '../../../../supabase/functions/_shared/customer-intelligence/purchase-exploration';
import { readAllPages } from '../../../../supabase/functions/_shared/customer-intelligence/query-pages';
import type { CoverageReview } from '../../../../supabase/functions/_shared/loyalty/programme-measurement';

type Report = ReturnType<typeof customerGrowthBreakdown>;
export function CustomerGrowthDashboard() {
  const { tenant, loading } = useTenant();
  const admin = useAdmin();
  if (loading || admin.isLoading || (admin.isMasterAdmin && (!admin.hasHydratedTenantContext || admin.activeTenantId !== tenant?.id)))
    return <Typography>Loading customer growth scope…</Typography>;
  if (!tenant?.id) return <Alert>Select a company to view customer growth.</Alert>;
  const timezone = typeof tenant.settings?.timezone === 'string' ? tenant.settings.timezone : 'America/Vancouver';
  return <CustomerGrowthDashboardBody key={`${tenant.id}:${timezone}`} tenantId={tenant.id} timezone={timezone} />;
}

export function CustomerGrowthDashboardBody({ tenantId, timezone }: { tenantId: string; timezone: string }) {
  const today = localDate(new Date().toISOString(), timezone)!;
  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = React.useState(currentYear - 1);
  const [currency, setCurrency] = React.useState<GrowthBreakdownSettings['currency']>('CAD');
  const [periodReviewed, setPeriodReviewed] = React.useState(false);
  const [periodEvidence, setPeriodEvidence] = React.useState('');
  const [historyReviewed, setHistoryReviewed] = React.useState(false);
  const [historyEvidence, setHistoryEvidence] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [report, setReport] = React.useState<Report | null>(null);
  const generation = React.useRef(0);
  const currentEnd = year === currentYear ? today : `${year}-12-31`;
  React.useEffect(() => () => { generation.current++; }, []);
  function clear() { generation.current++; setReport(null); setError(''); setBusy(false); }
  function changeYear(value: string) {
    clear(); setYear(Number(value)); setPeriodReviewed(false); setHistoryReviewed(false); setPeriodEvidence(''); setHistoryEvidence('');
  }
  const reviewReady = (!periodReviewed || periodEvidence.trim().length >= 8) && (!historyReviewed || (periodReviewed && historyEvidence.trim().length >= 8));
  async function calculate() {
    if (busy || !reviewReady || !Number.isInteger(year) || year < 1901 || year > currentYear) return;
    const version = ++generation.current;
    setBusy(true); setError(''); setReport(null);
    try {
      // Explicit company-wide analysis authority, in addition to the normal user
      // session and RLS. Location-limited access must not imply complete coverage.
      for (const permission of ['customer.read', 'reporting.read']) {
        const { data, error: permissionError } = await supabase.rpc('has_tenant_permission', { p_tenant_id: tenantId, p_permission: permission, p_location_id: null });
        if (permissionError || data !== true) throw new Error('Customer growth requires company-wide customer and reporting access.');
      }
      const cutoff = new Date().toISOString();
      const [customers, orders] = await Promise.all([
        readAllPages<{ id: string; tenant_id: string }>((from, to) => supabase.from('crm_customers').select('id,tenant_id').eq('tenant_id', tenantId).is('deleted_at', null).is('merged_into_customer_id', null).lte('created_at', cutoff).order('id').range(from, to)),
        readAllPages<GrowthOrder>((from, to) => supabase.from('pos_orders').select('id,tenant_id,crm_customer_id,order_date,created_at,total_amount,refund_amount,currency,status').eq('tenant_id', tenantId).lte('created_at', cutoff).order('id').range(from, to)),
      ]);
      if (customers.some(customer => customer.tenant_id !== tenantId)) throw new Error('Customer company scope changed. Retry the report.');
      const review = (reviewed: boolean, evidence: string): CoverageReview => ({ status: reviewed ? 'reviewed_complete' : 'unverified', evidence: evidence.trim(), reviewedAt: reviewed ? cutoff : null });
      const result = customerGrowthBreakdown(orders, customers.map(customer => customer.id), tenantId, {
        year, currentEnd, currency, timezone, cutoff,
        periods: review(periodReviewed, periodEvidence), earlierHistory: review(historyReviewed, historyEvidence),
      });
      if (version === generation.current) setReport(result);
    } catch (e) { if (version === generation.current) setError(e instanceof Error ? e.message : 'Customer growth is unavailable.'); }
    finally { if (version === generation.current) setBusy(false); }
  }
  return <Sheet variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: '20px' }}>
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography level="h3">Customer growth dashboard</Typography>
        <Typography level="body-sm">See how retention, new customers and recovered customers contribute to growth. This is a unique-customer breakdown, separate from the weighted Growth Index below.</Typography>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <FormControl><FormLabel>Reporting year</FormLabel><Input type="number" value={year} onChange={e => changeYear(e.target.value)} slotProps={{ input: { min: 1901, max: currentYear } }} /></FormControl>
        <FormControl><FormLabel>Growth currency</FormLabel><Select aria-label="Growth currency" value={currency} onChange={(_, value) => { if (value) { clear(); setCurrency(value); setPeriodReviewed(false); setHistoryReviewed(false); setPeriodEvidence(''); setHistoryEvidence(''); } }}>{(['CAD', 'USD', 'GBP', 'EUR'] as const).map(value => <Option key={value} value={value}>{value}</Option>)}</Select></FormControl>
      </Stack>
      <Typography level="body-sm">Current: {year}-01-01 through {currentEnd}. Previous: {year - 1}-01-01 through {year - 1}-12-31. Business timezone: {timezone}.</Typography>
      {year === currentYear && <Alert color="neutral">Year-to-date progress against the full previous year, not a matching-date year-over-year growth comparison. Today is still in progress. Annual averages and the annual sales estimate are not available for this partial year.</Alert>}
      <Box component="details" sx={{ border: '1px solid', borderColor: 'divider', p: 1.5, borderRadius: 'lg' }}>
        <Typography component="summary" level="title-sm" sx={{ cursor: 'pointer' }}>Source coverage review</Typography>
        <Stack spacing={1.5} sx={{ mt: 1.5 }}>
          <Alert color="neutral">Default: coverage unverified. Only review the loaded dated POS ledger, not a summary export. Human review is an assertion supported by your evidence, not system certification. Nothing here changes imports, customers or permissions; reviews apply only to this report and reset when the company, year or currency changes.</Alert>
          <Checkbox label="I reviewed complete previous-year and current-period purchase coverage for this company and currency" checked={periodReviewed} onChange={e => { clear(); setPeriodReviewed(e.target.checked); if (!e.target.checked) setHistoryReviewed(false); }} />
          <FormControl><FormLabel>Period coverage evidence</FormLabel><Textarea value={periodEvidence} placeholder="Source references, covered dates, reconciliation and identity checks. No customer details needed." minRows={2} onChange={e => { clear(); setPeriodEvidence(e.target.value); }} slotProps={{ textarea: { maxLength: 2000 } }} /></FormControl>
          <Checkbox label="I also reviewed all earlier purchase history, sufficient to establish first-ever customers" disabled={!periodReviewed} checked={historyReviewed} onChange={e => { clear(); setHistoryReviewed(e.target.checked); }} />
          <FormControl><FormLabel>Earlier-history evidence</FormLabel><Textarea value={historyEvidence} placeholder="Explain the complete historical source coverage, not merely the oldest available export." minRows={2} onChange={e => { clear(); setHistoryEvidence(e.target.value); }} slotProps={{ textarea: { maxLength: 2000 } }} /></FormControl>
          {!reviewReady && <Typography color="warning" level="body-sm">Each complete-coverage review needs an evidence description of at least eight characters. Earlier-history review also requires period review.</Typography>}
        </Stack>
      </Box>
      <Button loading={busy} disabled={!reviewReady || !Number.isInteger(year) || year < 1901 || year > currentYear} onClick={() => void calculate()}>Load customer growth dashboard</Button>
      <Typography level="body-xs">Reads dated POS orders only, using your existing access. Imported IdealPOS product summaries do not establish first-ever purchases or complete missing-year history. Their source-backed spending remains available below.</Typography>
      {error && <Alert color="danger" role="alert">{error}</Alert>}
      {report && <GrowthDashboardResult report={report} />}
    </Stack>
  </Sheet>;
}

function GrowthDashboardResult({ report }: { report: Report }) {
  const result = report.reviewed;
  const pct = (value: number | null | undefined) => value == null ? 'Not established' : `${value.toFixed(2)}%`;
  const count = (value: number | null | undefined) => value == null ? 'Not established' : value.toLocaleString();
  const money = (value: number | null | undefined) => value == null ? 'Not established' : new Intl.NumberFormat('en-CA', { style: 'currency', currency: report.settings.currency }).format(value);
  const metrics = [
    ['Previous-year active customers', result?.previous, result ? (result.previous > 0 ? '100% denominator' : 'No percentage denominator') : 'Coverage unverified'],
    ['Retained customers', result?.retained, pct(result?.retentionPercent)],
    ['New customers (first-ever)', result?.newCustomers, pct(result?.newPercent)],
    ['Recovered customers', result?.recovered, pct(result?.recoveredPercent)],
    [report.fullYear ? 'Lost customers' : 'Not yet returned this year', result?.lost, pct(result?.lossPercent)],
    ['Current active customers', result?.current, 'Retained + new + recovered + unclassified'],
    ['Net customer growth', result?.net, pct(result?.growthPercent)],
    ['Current customers needing earlier-history review', result?.unclassified, pct(result?.unclassifiedPercent)],
  ] as const;
  return <Stack spacing={2}>
    <Alert color={report.status === 'reviewed' ? 'neutral' : 'warning'}>
      {report.status === 'reviewed' ? 'Calculated using your documented coverage reviews. This is not independent system certification.' : report.status === 'reconciliation_required' ? 'Source reconciliation is required. Invalid, unlinked, inaccessible or other-currency records prevent complete customer-growth claims.' : report.status === 'earlier_history_unverified' ? 'The period review supports retention and recovered customers, but first-ever new customers remain unclassified until earlier-history coverage is reviewed.' : 'Coverage is unverified. Observed ledger counts below are not complete business totals; missing records are not zero purchases.'}
    </Alert>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(4,minmax(0,1fr))' }, gap: 1 }}>
      {metrics.map(([label, value, detail]) => <Sheet key={label} variant="soft" sx={{ p: 1.5, borderRadius: 'lg' }}><Typography level="body-sm">{label}</Typography><Typography level="h4">{count(value)}</Typography><Typography level="body-xs">{detail}</Typography></Sheet>)}
    </Box>
    <Typography level="body-sm">{report.formula}</Typography>
    {result && result.unclassified > 0 && <Typography level="body-sm">Until earlier history is reviewed, add the unclassified contribution ({pct(result.unclassifiedPercent)}) to reconcile current customers. It must not be labelled new.</Typography>}
    {result && result.previous === 0 && <Typography level="body-sm">The previous-year count is zero. Net customer count is available, but percentage growth and contribution percentages are undefined.</Typography>}
    <Typography level="body-sm">Retained: bought in both years. New: first-ever purchase in the current year. Recovered: bought in the current year, skipped the entire previous calendar year, and bought earlier. Lost: bought last year but not in the current period{report.fullYear ? '.' : ' so far; they may still return this year.'}</Typography>
    <Box sx={{ overflowX: 'auto' }}><Table aria-label="Sales per customer by growth cohort" sx={{ minWidth: 380 }}><thead><tr><th>Customer group</th><th>{report.fullYear ? 'Average annual sales per customer' : 'Average period sales per customer'}</th></tr></thead><tbody>
      <tr><td>Retained</td><td>{money(result?.retainedAverage)}</td></tr>
      <tr><td>New (first-ever)</td><td>{money(result?.newAverage)}</td></tr>
      <tr><td>Recovered</td><td>{money(result?.recoveredAverage)}</td></tr>
    </tbody></Table></Box>
    <Sheet variant="soft" sx={{ p: 2, borderRadius: 'lg' }}><Typography level="title-sm">Estimated annual sales effect of net customer change</Typography><Typography level="h4">{money(result?.estimatedAnnualSalesEffect)}</Typography><Typography level="body-sm">{report.estimateAssumption}</Typography>{!report.fullYear && <Typography level="body-xs">Unavailable for a partial year. Period spending is not silently annualized.</Typography>}</Sheet>
    <Box component="details"><Typography component="summary" level="title-sm" sx={{ cursor: 'pointer' }}>Observed records and calculation evidence</Typography><Stack spacing={1} sx={{ mt: 1 }}>
      <Typography level="body-sm">Observed previous-year buyers: {report.observed.previous}; current buyers: {report.observed.current}; present in both: {report.observed.retained}; earlier buyers absent last year in these records: {report.observed.recoveredCandidates}; first observed this year: {report.observed.firstObserved}; not observed returning: {report.observed.notReturned}. These counts are not completeness claims.</Typography>
      <Typography level="body-xs">{report.source}</Typography>
      <Typography level="body-xs">Invalid rows: {report.unknown.invalidOrderRows}; unlinked orders: {report.unknown.unlinkedOrders}; orders outside the current customer population: {report.unknown.outsidePopulationOrders}; other currencies present: {report.unknown.otherCurrency ? 'yes' : 'no'}. No customer identities are shown.</Typography>
      <Typography level="body-xs">Evidence cutoff: {report.settings.cutoff}. Currency: {report.settings.currency}. Timezone: {report.settings.timezone}.</Typography>
      <Typography level="body-xs">Period review: {report.settings.periods.status}; {report.settings.periods.reviewedAt ?? 'not reviewed'}. Evidence: {report.settings.periods.evidence || 'none supplied'}.</Typography>
      <Typography level="body-xs">Earlier-history review: {report.settings.earlierHistory.status}; {report.settings.earlierHistory.reviewedAt ?? 'not reviewed'}. Evidence: {report.settings.earlierHistory.evidence || 'none supplied'}.</Typography>
    </Stack></Box>
  </Stack>;
}
