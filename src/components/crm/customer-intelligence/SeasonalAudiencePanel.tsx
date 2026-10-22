import { useState } from 'react';
import { Alert, Button, Checkbox, FormControl, FormLabel, Input, Option, Select, Stack, Typography } from '@mui/joy';
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
    <Typography level="title-md">Bring last season’s buyers back</Typography>
    <Typography level="body-sm">Choose the actual season and product—for example, hanging baskets bought last spring. Dates use {timezone}.</Typography>
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
      <FormControl sx={{ flex: 1 }}><FormLabel>Product name or SKU</FormLabel><Input required value={product} onChange={e => setProduct(e.target.value)} placeholder="Hanging basket" slotProps={{ input: { maxLength: 180 } }} /></FormControl>
      <FormControl><FormLabel>Match purchases by</FormLabel><Select value={match} onChange={(_, value) => { if (value) setMatch(value); }}><Option value="contains">Name or code contains</Option><Option value="sku">Exact SKU</Option></Select></FormControl>
    </Stack>
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
      <FormControl><FormLabel>Season starts</FormLabel><Input type="date" required value={from} onChange={e => setFrom(e.target.value)} /></FormControl>
      <FormControl><FormLabel>Season ends</FormLabel><Input type="date" required value={to} onChange={e => setTo(e.target.value)} /></FormControl>
    </Stack>
    <Checkbox checked={exclude} onChange={e => setExclude(e.target.checked)} label="Exclude buyers with any recorded purchase in a later window" />
    {exclude && <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
      <FormControl><FormLabel>Later window starts</FormLabel><Input type="date" required value={excludeFrom} onChange={e => setExcludeFrom(e.target.value)} /></FormControl>
      <FormControl><FormLabel>Later window ends</FormLabel><Input type="date" required value={excludeTo} onChange={e => setExcludeTo(e.target.value)} /></FormControl>
    </Stack>}
    {error && <Alert color="danger" role="alert">{error}</Alert>}
    <Button type="submit" variant="outlined">Review seasonal audience with Bloom</Button>
    <Typography level="body-xs" color="neutral">Opens a question for review. Bloom checks the available purchase evidence; campaign consent and suppression checks still apply before any send.</Typography>
  </Stack>;
}
