import { useState } from 'react';
import { Alert, Button, Checkbox, FormControl, FormLabel, Input, Option, Select, Stack, Typography } from '@mui/joy';
import { IntelligenceActions, IntelligenceFieldGrid, IntelligenceNote } from './IntelligenceLayout';
import { seasonalAudienceQuestion } from '@/lib/customer-intelligence/seasonalAudience';

export function SeasonalAudiencePanel({ timezone, onExplore }: { timezone: string; onExplore: (question: string) => void }) {
  const [product, setProduct] = useState('');
  const [match, setMatch] = useState<'contains' | 'sku'>('contains');
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [exclude, setExclude] = useState(false);
  const [excludeFrom, setExcludeFrom] = useState(''), [excludeTo, setExcludeTo] = useState('');
  const [error, setError] = useState('');
  return <Stack component="form" spacing={1.5} onSubmit={(event) => {
    event.preventDefault();
    try { onExplore(seasonalAudienceQuestion({ product, match, from, to, timezone, ...(exclude ? { excludeFrom, excludeTo } : {}) })); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Check the audience filters.'); }
  }}>
    <Typography level="title-sm">Bring last season’s buyers back</Typography>
    <Typography level="body-sm" sx={{ color: 'neutral.600' }}>Choose the actual season and product—for example, hanging baskets bought last spring. Dates use {timezone}.</Typography>
    <IntelligenceFieldGrid columns={2}>
      <FormControl size="sm"><FormLabel>Product name or SKU</FormLabel><Input size="sm" required value={product} onChange={e => setProduct(e.target.value)} placeholder="Hanging basket" slotProps={{ input: { maxLength: 180 } }} /></FormControl>
      <FormControl size="sm"><FormLabel>Match purchases by</FormLabel><Select size="sm" value={match} onChange={(_, value) => { if (value) setMatch(value); }}><Option value="contains">Name or code contains</Option><Option value="sku">Exact SKU</Option></Select></FormControl>
    </IntelligenceFieldGrid>
    <IntelligenceFieldGrid columns={4}>
      <FormControl size="sm"><FormLabel>Season starts</FormLabel><Input size="sm" type="date" required value={from} onChange={e => setFrom(e.target.value)} /></FormControl>
      <FormControl size="sm"><FormLabel>Season ends</FormLabel><Input size="sm" type="date" required value={to} onChange={e => setTo(e.target.value)} /></FormControl>
    </IntelligenceFieldGrid>
    <Checkbox size="sm" checked={exclude} onChange={e => setExclude(e.target.checked)} label="Exclude buyers with any recorded purchase in a later window" />
    {exclude && <IntelligenceFieldGrid columns={4}>
      <FormControl size="sm"><FormLabel>Later window starts</FormLabel><Input size="sm" type="date" required value={excludeFrom} onChange={e => setExcludeFrom(e.target.value)} /></FormControl>
      <FormControl size="sm"><FormLabel>Later window ends</FormLabel><Input size="sm" type="date" required value={excludeTo} onChange={e => setExcludeTo(e.target.value)} /></FormControl>
    </IntelligenceFieldGrid>}
    {error && <Alert color="danger" role="alert">{error}</Alert>}
    <IntelligenceActions><Button size="sm" type="submit" variant="outlined" color="neutral">Review seasonal audience with Bloom</Button></IntelligenceActions>
    <IntelligenceNote>Opens a question for review. Bloom checks the available purchase evidence; campaign consent and suppression checks still apply before any send.</IntelligenceNote>
  </Stack>;
}
