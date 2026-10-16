import { assertDate, type PurchaseFact } from './purchase-exploration.ts';

export interface PeriodSummaryEvent {
  id: string; tenant_id: string; customer_id: string | null; import_id: string;
  source: string; created_at: string; raw_data: unknown;
}
/** A reported product total is evidence of purchasing within a period, never a receipt. */
export function periodSummaryFacts(events: PeriodSummaryEvent[], tenantId: string): PurchaseFact[] {
  return events.flatMap(event => {
    if (event.tenant_id !== tenantId) throw new Error('Cross-company report evidence was rejected.');
    const raw = event.raw_data as Record<string, unknown> | null;
    if (!raw || raw.kind !== 'purchase_summary' || !Array.isArray(raw.items)
      || typeof raw.period_start !== 'string' || typeof raw.period_end !== 'string'
      || typeof raw.currency !== 'string') throw new Error('The imported report evidence needs reconciliation.');
    assertDate(raw.period_start); assertDate(raw.period_end);
    if (raw.period_start > raw.period_end) throw new Error('The report period is invalid.');
    return raw.items.map((item, index) => {
      if (!Array.isArray(item) || item.length !== 6 || typeof item[0] !== 'string' || typeof item[1] !== 'string'
        || typeof item[2] !== 'string' || typeof item[3] !== 'number' || !Number.isFinite(item[3])
        || typeof item[4] !== 'number' || !Number.isFinite(item[4]) || !Number.isInteger(item[5]))
        throw new Error('A source product summary has invalid fields. No partial audience was returned.');
      return { id: `${event.id}:${index}`, tenant_id: event.tenant_id, customer_id: event.customer_id,
        import_id: event.import_id, source: event.source, created_at: event.created_at,
        product_code: item[0], product_name: item[1], department: item[2], sales_category: null,
        quantity: item[3], net_amount: item[4], currency: raw.currency as string, purchased_at: null,
        evidence_kind: 'period_summary' as const, source_period_start: raw.period_start as string,
        source_period_end: raw.period_end as string };
    });
  });
}

export interface SummaryImport { id: string; source: string; source_period_start: string | null; source_period_end: string | null; }
/** Input is newest first. A newer cumulative export supersedes covered earlier snapshots. */
export function currentSummaryImports(imports: SummaryImport[]): SummaryImport[] {
  const selected: SummaryImport[] = [];
  for (const item of imports) {
    if (!item.source_period_start || !item.source_period_end) throw new Error('Source summary periods need reconciliation.');
    assertDate(item.source_period_start); assertDate(item.source_period_end);
    const overlapping = selected.filter(s => s.source === item.source && s.source_period_start! <= item.source_period_end! && s.source_period_end! >= item.source_period_start!);
    if (overlapping.some(s => s.source_period_start! <= item.source_period_start! && s.source_period_end! >= item.source_period_end!)) continue;
    if (overlapping.length) throw new Error('Overlapping summary exports need reconciliation before a complete audience can be returned.');
    selected.push(item);
  }
  return selected;
}
