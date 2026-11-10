import { createProgrammeDraft, getProgrammeTemplate } from '../../../supabase/functions/_shared/loyalty/programme-templates';
import { parseMoneyInput, parseProgrammeDraft, type LoyaltyCurrency, type ProgrammeDraft, type Reward } from '../../../supabase/functions/_shared/loyalty/programme-planning';

export interface ProgrammeForm {
  templateId: string; name: string; audience: string; startsOn: string; endsOn: string;
  currency: LoyaltyCurrency; timezone: string; minimum: string; threshold: ProgrammeDraft['threshold'];
  repeat: ProgrammeDraft['repeat']; perMember: string; total: string; budget: string;
  amount: string; percent: string; cap: string; sku: string; giftUnits: string; cost: string;
  experience: string; groupSize: string; freeUnits: string;
  eligibleSkus: string; departments: string; excludeDiscounted: boolean; membersOnly: boolean;
}
export function createProgrammeForm(templateId: string, currency: LoyaltyCurrency, startsOn: string, timezone: string): ProgrammeForm {
  const d = createProgrammeDraft(templateId, currency, startsOn, timezone);
  return { templateId, name: d.name, audience: d.audienceDescription, startsOn, endsOn: d.endsOn, currency, timezone,
    minimum: (d.minimumSpendMinor / 100).toFixed(2), threshold: d.threshold, repeat: d.repeat,
    perMember: String(d.maxAwardsPerMember), total: String(d.maxAwardsTotal), budget: '',
    amount: '10.00', percent: '20', cap: '20.00', sku: '', giftUnits: '1', cost: '', experience: '',
    groupSize: '3', freeUnits: '1', eligibleSkus: '', departments: '', excludeDiscounted: true, membersOnly: d.membersOnly };
}
function whole(value: string, label: string): number {
  if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(Number(value))) throw new Error(`${label} must be a whole number.`);
  return Number(value);
}
const list = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);
export function parseProgrammeForm(f: ProgrammeForm): ProgrammeDraft {
  const template = getProgrammeTemplate(f.templateId);
  const costMinor = f.cost.trim() ? parseMoneyInput(f.cost) : null;
  const kind = template.rewardKind;
  const reward: Reward = kind === 'gift' ? { kind, sku: f.sku, units: whole(f.giftUnits, 'Gift units'), costMinor }
    : kind === 'experience' ? { kind, reference: f.experience, costMinor }
    : kind === 'percentage' ? { kind, basisPoints: parseMoneyInput(f.percent), capMinor: parseMoneyInput(f.cap) }
    : kind === 'multi_buy' ? { kind, groupSize: whole(f.groupSize, 'Group size'), freeUnits: whole(f.freeUnits, 'Free units'), capMinor: parseMoneyInput(f.cap) }
    : { kind, amountMinor: parseMoneyInput(f.amount) };
  return parseProgrammeDraft({ version: 1, templateId: f.templateId, name: f.name, audienceDescription: f.audience, trigger: template.trigger,
    currency: f.currency, timezone: f.timezone, startsOn: f.startsOn, endsOn: f.endsOn,
    minimumSpendMinor: parseMoneyInput(f.minimum), threshold: f.threshold, repeat: f.repeat,
    maxAwardsPerMember: whole(f.perMember, 'Awards per member'), maxAwardsTotal: whole(f.total, 'Total awards'),
    budgetMinor: f.budget.trim() ? parseMoneyInput(f.budget) : null, eligibleSkus: list(f.eligibleSkus), eligibleDepartments: list(f.departments),
    excludeDiscounted: f.excludeDiscounted, membersOnly: f.membersOnly, reward });
}
export function exportProgrammeDraft(draft: ProgrammeDraft): string {
  return JSON.stringify({ status: 'draft_planning_only', productionAuthorized: false, draft: parseProgrammeDraft(draft),
    note: 'This file contains a draft configuration, not customer data, an issued benefit, a POS authorization or a scheduled campaign.' }, null, 2);
}

export function programmeFormFromDraft(d: ProgrammeDraft): ProgrammeForm {
  const f = createProgrammeForm(d.templateId, d.currency, d.startsOn, d.timezone);
  Object.assign(f, { name: d.name, audience: d.audienceDescription, endsOn: d.endsOn, minimum: (d.minimumSpendMinor / 100).toFixed(2),
    threshold: d.threshold, repeat: d.repeat, perMember: String(d.maxAwardsPerMember), total: String(d.maxAwardsTotal),
    budget: d.budgetMinor === null ? '' : (d.budgetMinor / 100).toFixed(2), eligibleSkus: d.eligibleSkus.join(', '),
    departments: d.eligibleDepartments.join(', '), excludeDiscounted: d.excludeDiscounted, membersOnly: d.membersOnly });
  if (d.reward.kind === 'fixed') f.amount = (d.reward.amountMinor / 100).toFixed(2);
  if (d.reward.kind === 'percentage') { f.percent = String(d.reward.basisPoints / 100); f.cap = (d.reward.capMinor / 100).toFixed(2); }
  if (d.reward.kind === 'gift') { f.sku = d.reward.sku; f.giftUnits = String(d.reward.units); f.cost = d.reward.costMinor === null ? '' : (d.reward.costMinor / 100).toFixed(2); }
  if (d.reward.kind === 'experience') { f.experience = d.reward.reference; f.cost = d.reward.costMinor === null ? '' : (d.reward.costMinor / 100).toFixed(2); }
  if (d.reward.kind === 'multi_buy') { f.groupSize = String(d.reward.groupSize); f.freeUnits = String(d.reward.freeUnits); f.cap = (d.reward.capMinor / 100).toFixed(2); }
  return f;
}
