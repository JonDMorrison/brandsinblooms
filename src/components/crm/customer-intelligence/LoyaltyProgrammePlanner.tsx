import { bloomIntelligenceUrl } from "@/lib/customer-intelligence/intelligenceExperience";
import * as React from 'react';
import { Accordion, AccordionDetails, AccordionGroup, AccordionSummary, Alert, Box, Button, Checkbox, Chip, Divider, FormControl, FormLabel, Input, Option, Select, Sheet, Stack, Textarea, Typography } from '@mui/joy';
import { ArrowRight, Download, Gift, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { businessDate, getProgrammeTemplate, programmePlanningPrompt, PROGRAMME_TEMPLATES } from '../../../../supabase/functions/_shared/loyalty/programme-templates';
import { formatLoyaltyMoney, LOYALTY_CURRENCIES, parseMoneyInput, programmeRuleSummary, requiredProgrammeCapabilities, simulateProgramme, type LoyaltyCurrency, type ProgrammeDraft, type ProgrammePreview } from '../../../../supabase/functions/_shared/loyalty/programme-planning';
import { createProgrammeForm, programmeFormFromDraft, exportProgrammeDraft, parseProgrammeForm, type ProgrammeForm } from '@/lib/loyalty/programmeForm';

interface Props { tenantId: string; timezone: string; currency?: LoyaltyCurrency; initialDraft?: ProgrammeDraft; onSaveDraft?: (draft: ProgrammeDraft) => Promise<void>; }
/** Remounts on company changes; no draft is persisted across tenants or silently activated. */
export function LoyaltyProgrammePlanner(props: Props) {
  return <ProgrammeWorksheet key={`${props.tenantId}:${props.timezone}:${props.currency ?? 'CAD'}`} {...props} />;
}
function ProgrammeWorksheet({ timezone, currency = 'CAD', initialDraft, onSaveDraft }: Props) {
  const navigate = useNavigate();
  const [form, setForm] = React.useState(() => initialDraft ? programmeFormFromDraft(initialDraft) : createProgrammeForm('welcome', currency, businessDate(new Date(), timezone), timezone));
  const [basket, setBasket] = React.useState('100.00');
  const [quantity, setQuantity] = React.useState('1');
  const [memberAwards, setMemberAwards] = React.useState('0');
  const [totalAwards, setTotalAwards] = React.useState('0');
  const [stock, setStock] = React.useState('');
  const [remaining, setRemaining] = React.useState('');
  const [report, setReport] = React.useState<ProgrammePreview | null>(null);
  const [actionError, setActionError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  async function save() {
    if (!parsed.draft || !onSaveDraft || saving) return;
    setSaving(true); setActionError('');
    try { await onSaveDraft(parsed.draft); } catch (e) { setActionError(e instanceof Error ? e.message : 'Draft could not be saved.'); } finally { setSaving(false); }
  }
  const template = getProgrammeTemplate(form.templateId);
  const parsed = React.useMemo(() => { try { return { draft: parseProgrammeForm(form), error: '' }; } catch (e) { return { draft: null, error: e instanceof Error ? e.message : 'Review the programme fields.' }; } }, [form]);
  const summary = parsed.draft ? programmeRuleSummary(parsed.draft) : [];
  const update = <K extends keyof ProgrammeForm>(key: K, value: ProgrammeForm[K]) => { setForm(f => ({ ...f, [key]: value })); setReport(null); setActionError(''); };
  const field = (key: keyof ProgrammeForm, label: string, type = 'text') => <FormControl key={key}><FormLabel>{label}</FormLabel><Input type={type} value={String(form[key])} onChange={e => update(key, e.target.value as ProgrammeForm[typeof key])} /></FormControl>;
  const number = (value: string): number | null => value.trim() === '' ? null : /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : Number.NaN;
  const simulate = () => {
    if (!parsed.draft) return;
    try {
      const draft = parsed.draft;
      const result = simulateProgramme(draft, { occurredAt: new Date().toISOString(), currency: draft.currency, isMember: true, matchesAudience: true, triggerVerified: true,
        memberAwards: number(memberAwards), totalAwards: number(totalAwards), remainingBudgetMinor: remaining.trim() ? parseMoneyInput(remaining) : null,
        giftUnitsAvailable: number(stock), placesAvailable: number(stock),
        lines: [{ id: 'fictional-line', sku: draft.eligibleSkus[0] || 'FICTIONAL-MERCHANDISE', department: draft.eligibleDepartments[0] || 'Example department', kind: 'goods', quantity: number(quantity) ?? Number.NaN, unitPriceMinor: parseMoneyInput(basket), discountMinor: 0 }] });
      setReport(result); setActionError('');
    } catch (e) { setReport(null); setActionError(e instanceof Error ? e.message : 'Unable to simulate this draft.'); }
  };
  const download = () => {
    if (!parsed.draft) return;
    try {
      const url = URL.createObjectURL(new Blob([exportProgrammeDraft(parsed.draft)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `loyalty-${template.id}-draft.json`; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setActionError('');
    } catch { setActionError('Draft export failed. Your fields have not been changed.'); }
  };
  const scenarioField = (label: string, value: string, setter: (value: string) => void, placeholder?: string) => <FormControl><FormLabel>{label}</FormLabel><Input value={value} placeholder={placeholder} onChange={e => { setter(e.target.value); setReport(null); setActionError(''); }} /></FormControl>;
  return <Sheet variant="outlined" sx={{ borderRadius: 'xl', overflow: 'hidden' }}>
    <AccordionGroup><Accordion>
      <AccordionSummary sx={{ px: { xs: 2, md: 3 }, py: 1.5 }}><Stack direction="row" alignItems="center" gap={1.5} sx={{ flexWrap: 'wrap' }}><Gift size={20} /><Typography level="title-lg">Loyalty programme planner</Typography><Chip size="sm" variant="soft" color="neutral">Drafts & simulations</Chip></Stack></AccordionSummary>
      <AccordionDetails sx={{ p: { xs: 2, md: 3 } }}><Stack spacing={3}>
        <Stack spacing={0.75}><Typography level="h3">Give customers a reason to return.</Typography><Typography level="body-md">Plan rewards, experiences and thoughtful recognition around an audience you can explain. Existing points and gift-card balances stay unchanged.</Typography></Stack>
        <Alert color="neutral" variant="soft">Planning only. This workspace does not issue rewards, authorize discounts, save an active programme or send messages. Export a draft to keep it; unsaved fields are cleared when the company or page changes.</Alert>
        <Stack spacing={1.5}>
          <Typography level="title-lg">1. Choose the relationship you want to grow</Typography>
          <FormControl><FormLabel>Programme template</FormLabel><Select value={form.templateId} onChange={(_, id) => { if (id) { setForm(createProgrammeForm(id, form.currency, businessDate(new Date(), form.timezone), form.timezone)); setReport(null); setActionError(''); } }}>{PROGRAMME_TEMPLATES.map(item => <Option key={item.id} value={item.id}>{item.name}</Option>)}</Select></FormControl>
          <Typography level="body-sm">{template.description} Changing templates starts a new draft.</Typography>
          {field('name', 'Programme name')}
          <FormControl><FormLabel>Audience definition to review</FormLabel><Textarea value={form.audience} minRows={3} onChange={e => update('audience', e.target.value)} /></FormControl>
          <Typography level="body-sm">This description does not execute a customer query. Review the actual matching group with Bloom before selecting recipients. Target outcome: {template.outcome}.</Typography>
        </Stack>
        <Divider />
        <Stack spacing={1.5}>
          <Typography level="title-lg">2. Set the benefit and its limits</Typography>
          <Typography level="body-sm">Starter amounts are examples, not pricing recommendations. Changing currency does not convert amounts.</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
            <FormControl><FormLabel>Reward currency</FormLabel><Select value={form.currency} onChange={(_, value) => { if (value) update('currency', value); }}>{LOYALTY_CURRENCIES.map(item => <Option key={item} value={item}>{item}</Option>)}</Select></FormControl>
            {template.rewardKind === 'fixed' && field('amount', 'Voucher amount')}
            {template.rewardKind === 'percentage' && field('percent', 'Discount percent')}
            {['percentage', 'multi_buy'].includes(template.rewardKind) && field('cap', 'Maximum discount per award')}
            {template.rewardKind === 'gift' && <>{field('sku', 'Gift SKU')}{field('giftUnits', 'Gift units per award')}{field('cost', 'Actual cost per gift unit (blank = unknown)')}</>}
            {template.rewardKind === 'experience' && <>{field('experience', 'Existing experience or event reference')}{field('cost', 'Actual experience cost (blank = unknown)')}</>}
            {template.rewardKind === 'multi_buy' && <>{field('groupSize', 'Units in each multi-buy group')}{field('freeUnits', 'Free units per group')}</>}
            {field('minimum', 'Minimum eligible merchandise spend')}
            <FormControl><FormLabel>Spend comparison</FormLabel><Select value={form.threshold} onChange={(_, value) => { if (value) update('threshold', value); }}><Option value="at_least">At least the minimum</Option><Option value="more_than">More than the minimum</Option></Select></FormControl>
            {field('startsOn', 'Programme starts', 'date')}{field('endsOn', 'Programme ends', 'date')}
            {field('eligibleSkus', 'Eligible SKUs (comma separated; blank = any)')}{field('departments', 'Eligible departments (comma separated; blank = any)')}
            <FormControl><FormLabel>Award frequency</FormLabel><Select value={form.repeat} onChange={(_, value) => { if (value) { setForm(f => ({ ...f, repeat: value, perMember: value === 'once_per_member' ? '1' : f.perMember })); setReport(null); } }}><Option value="once_per_member">Once per member</Option><Option value="per_qualifying_event">Repeat across qualifying events</Option></Select></FormControl>
            {field('perMember', 'Maximum awards per member')}{field('total', 'Maximum awards overall')}{field('budget', 'Programme cost budget (blank = not set)')}
          </Box>
          <Checkbox label="Membership is required" checked={form.membersOnly} onChange={e => update('membersOnly', e.target.checked)} />
          <Checkbox label="Exclude already-discounted merchandise" checked={form.excludeDiscounted} onChange={e => update('excludeDiscounted', e.target.checked)} />
          <Typography level="body-sm">Times use {form.timezone}. Promotional benefits, purchased gift cards and provider points remain separate.</Typography>
        </Stack>
        <Divider />
        <Stack spacing={1.5}>
          <Typography level="title-lg">3. Review exactly what the rules say</Typography>
          {parsed.error ? <Alert color="warning">{parsed.error}</Alert> : <Sheet variant="soft" sx={{ p: 2, borderRadius: 'lg' }}><Stack spacing={1}>{summary.map(line => <Typography key={line} level="body-sm">{line}</Typography>)}</Stack></Sheet>}
          <Typography level="title-sm">Evidence still needed for this programme</Typography>
          {template.evidence.map(item => <Typography key={item} level="body-sm">{item}</Typography>)}
          {parsed.draft && <Typography level="body-sm">Before launch: {requiredProgrammeCapabilities(parsed.draft).join('; ')}. These capabilities are not verified by this preview.</Typography>}
        </Stack>
        <Divider />
        <Stack spacing={1.5}>
          <Typography level="title-lg">4. Try a fictional basket</Typography>
          <Typography level="body-sm">No customer records are used. This example assumes a confirmed member, a matching reviewed audience and a verified qualifying event. It uses the current date, one eligible merchandise SKU, and no existing discount. Gift stock, capacity and award history are illustrative inputs—not live lookups.</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
            {scenarioField('Example unit price', basket, setBasket)}{scenarioField('Example quantity', quantity, setQuantity)}
            {scenarioField('Previous awards for this member', memberAwards, setMemberAwards)}{scenarioField('Previous awards overall', totalAwards, setTotalAwards)}
            {scenarioField('Available gift units or places', stock, setStock, 'Unknown')}{scenarioField('Remaining cost budget', remaining, setRemaining, 'Unknown')}
          </Box>
          <Button variant="outlined" disabled={!parsed.draft} onClick={simulate}>Preview fictional basket</Button>
          {report && <Alert color={report.state === 'eligible' ? 'primary' : 'neutral'}><Stack spacing={0.75}><Typography level="title-sm">{report.state === 'eligible' ? 'Example meets the planning rules' : report.state === 'ineligible' ? 'Example does not qualify' : 'More information is needed'}</Typography><Typography level="body-sm">{report.reason}</Typography><Typography level="body-sm">Eligible goods: {formatLoyaltyMoney(report.eligibleSubtotalMinor, form.currency)}. Proposed discount: {formatLoyaltyMoney(report.discountMinor, form.currency)}. Proposed gift units: {report.giftUnits}.</Typography>{report.warnings.map(warning => <Typography level="body-sm" key={warning}>{warning}</Typography>)}</Stack></Alert>}
        </Stack>
        {actionError && <Alert role="alert" color="danger">{actionError}</Alert>}
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <Button startDecorator={<Sparkles size={16} />} endDecorator={<ArrowRight size={16} />} disabled={!parsed.draft} onClick={() => { if (parsed.draft) navigate(bloomIntelligenceUrl(programmePlanningPrompt(parsed.draft, summary), 'rewards')); }}>Review draft with Bloom</Button>
          <Button variant="outlined" startDecorator={<Download size={16} />} disabled={!parsed.draft} onClick={download}>Export draft</Button>
          {onSaveDraft && <Button loading={saving} disabled={!parsed.draft} onClick={() => void save()}>Save programme draft</Button>}
        </Stack>
      </Stack></AccordionDetails>
    </Accordion></AccordionGroup>
  </Sheet>;
}
