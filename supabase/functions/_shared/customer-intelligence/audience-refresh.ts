import {explorePurchases, type CustomerSet, type PurchaseFact} from './purchase-exploration.ts';

/** Pure refresh plan. Persistence must authorize the caller and atomically replace membership. */
export function planAudienceRefresh(input: {
  mode: 'fixed' | 'dynamic'; saved: CustomerSet; tenantId: string; userId: string;
  conversationId: string; population: string[]; facts: PurchaseFact[];
  excludedIds: string[]; now: string;
}) {
  const {saved} = input;
  if (saved.tenant_id !== input.tenantId || saved.user_id !== input.userId || saved.conversation_id !== input.conversationId)
    throw new Error('The audience is outside this user, company, or conversation.');
  const visible = new Set(input.population), exclusions = new Set(input.excludedIds);
  if (input.excludedIds.some(id => !visible.has(id))) throw new Error('An exclusion is outside the accessible population.');
  const savedIdentities = [...saved.included_ids, ...saved.excluded_ids, ...saved.unknown_ids,
    ...Object.keys(saved.reasons), ...Object.keys(saved.evidence_ids), ...Object.keys(saved.anchors)];
  if (input.mode === 'fixed' && savedIdentities.some(id => !visible.has(id)))
    throw new Error('A fixed audience member is no longer accessible. Review membership before continuing.');
  let refreshed = saved;
  const unknown = new Set<string>();
  const excluded = new Set<string>(input.excludedIds);
  if (input.mode === 'dynamic') {
    if (!saved.trail.length || saved.trail.length > 30) throw new Error('The saved audience needs a complete rule history.');
    let previous: CustomerSet | undefined;
    // Start again from the current population, never from yesterday's matching members.
    for (const step of saved.trail) {
      if ('reported_spending' in step) throw new Error('Reported spending rules are not replayable yet. Save a fixed audience.');
      previous = explorePurchases({tenantId: input.tenantId, userId: input.userId,
        conversationId: input.conversationId, timezone: saved.timezone,
        population: input.population, facts: input.facts, rule: step.rule,
        label: step.label, previous, now: input.now, allowMissingAnchors: true});
      for (const id of previous.excluded_ids) excluded.add(id);
      for (const id of previous.unknown_ids) unknown.add(id);
    }
    refreshed = previous!;
  } else {
    for (const id of saved.excluded_ids) excluded.add(id);
    for (const id of saved.unknown_ids) if (visible.has(id)) unknown.add(id);
  }
  const members = refreshed.included_ids.filter(id => !exclusions.has(id)).sort();
  const before = new Set(saved.included_ids), after = new Set(members);
  return {mode: input.mode, source_read_at: refreshed.captured_at, result: refreshed,
    member_ids: members, excluded_ids: [...excluded].sort(), unknown_ids: [...unknown].filter(id => !exclusions.has(id)).sort(),
    manual_exclusion_ids: [...exclusions].sort(),
    added_ids: members.filter(id => !before.has(id)),
    removed_ids: saved.included_ids.filter(id => visible.has(id) && !after.has(id)).sort(),
    membership_captured_at: input.mode === 'fixed' ? saved.captured_at : input.now};
}

/** Combine disjoint customer batches before one atomic publication. Never persist partial plans. */
export function appendAudienceRefreshPlan(target: ReturnType<typeof planAudienceRefresh> | null, part: ReturnType<typeof planAudienceRefresh>) {
  if (!target) return part;
  if(target.result.tenant_id!==part.result.tenant_id || target.result.user_id!==part.result.user_id || target.result.conversation_id!==part.result.conversation_id || target.source_read_at!==part.source_read_at || target.result.trail.length!==part.result.trail.length) throw new Error('Incompatible audience batches.');
  for(const key of ['member_ids','excluded_ids','unknown_ids','manual_exclusion_ids','added_ids','removed_ids'] as const) for(const id of part[key]) target[key].push(id);
  for(const key of ['included_ids','excluded_ids','unknown_ids'] as const) for(const id of part.result[key]) target.result[key].push(id);
  Object.assign(target.result.reasons,part.result.reasons);
  Object.assign(target.result.evidence_ids,part.result.evidence_ids);
  Object.assign(target.result.anchors,part.result.anchors);
  target.result.trail.forEach((step,index)=>{
    const next=part.result.trail[index];
    if(JSON.stringify(step.rule)!==JSON.stringify(next.rule))throw new Error('Audience batch rules differ.');
    for(const key of ['input','included','excluded','unknown'] as const)step[key]+=next[key];
  });
  return target;
}
