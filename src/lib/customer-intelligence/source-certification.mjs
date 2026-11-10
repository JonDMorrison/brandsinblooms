/** Review gate, never an import authorization. Claims embedded in a file are not observations. */
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const supported = new Set(['journal', 'points', 'coupons_redeemed', 'coupons_issued']);
export function createSourceCertificationGate({tenantId, sourceSha256, reportFamily}) {
  if (!tenantId || !sha(sourceSha256)) throw Error('Certification requires explicit tenant and source digest');
  const reasons = new Map(); const keys = new Set(); let rows = 0; let sourceReviewableRows = 0;
  const add = reason => reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  return {
    observe(row) {
      if (!supported.has(reportFamily)) return;
      rows++;
      if (row.source?.sha256 !== sourceSha256) add('source_hash_mismatch');
      if (!Number.isSafeInteger(row.source?.row) || row.source.row < 1 || typeof row.source?.sheet !== 'string') add('invalid_source_coordinates');
      if (row.committable !== false) add('untrusted_commit_claim');
      if (row.fields?.certificate || row.certificate) add('embedded_certificate_not_authoritative');
      if (reportFamily === 'journal') {
        const detail=row.fields;
        if(row.kind!=='receipt_evidence'||!Array.isArray(detail?.events)||!detail.events.length||detail.pageBoundaryProvenance!=='original_biff_horizontal_breaks_and_continue'||!Array.isArray(detail.sourceFinancialExclusions)||!Array.isArray(detail.originalAnchorErrors)||!Array.isArray(detail.sourceCoverage?.unrepresentedNumericCoordinates))add('original_detail_coverage_certificate_required');
        else {
          const exclusions=new Set([...detail.sourceFinancialExclusions,...detail.originalAnchorErrors]);
          if(detail.sourceCoverage.unrepresentedNumericCoordinates.length)exclusions.add('receipt_contains_unrepresented_numeric_anchors');
          if(!Array.isArray(detail.sourceCoverage.unownedNumericCoordinates)||detail.sourceCoverage.unownedNumericCoordinates.length)exclusions.add('source_contains_unowned_numeric_anchors');
          for(const reason of exclusions)add(`detail_${reason}`);
          if(!exclusions.size)sourceReviewableRows++;
        }
        add('exact_customer_master_link_required');
        add('timezone_contract_required');
        add('aggregate_overlap_selection_required');
        const f = row.fields ?? {};
        if (!Number.isFinite(f.localExcelDate) || !Number.isSafeInteger(f.terminal) || typeof f.receiptNumber !== 'string' || !f.receiptNumber) add('incomplete_receipt_identity');
        else {
          const key = JSON.stringify([f.terminal, f.receiptNumber, f.localExcelDate]);
          if (keys.has(key)) add('duplicate_receipt_identity'); else keys.add(key);
        }
      } else if (reportFamily === 'points') {
        add('points_event_semantics_certificate_required');
        add('opening_balance_not_established');
        add('exact_customer_master_link_required');
        add('timezone_contract_required');
      } else {
        add('coupon_owner_link_certificate_required');
        add('issued_redeemed_link_certificate_required');
        add('timezone_and_expiry_contract_required');
      }
    },
    finish() {
      return {version: 1, tenantId, sourceSha256, reportFamily,
        status: supported.has(reportFamily) ? 'incomplete' : 'not_applicable',
        committable: false, observedRows: rows, sourceReviewableRows,
        reasons: [...reasons].sort(([a], [b]) => a.localeCompare(b)).map(([code, count]) => ({code, count}))};
    }
  };
}

/** Validate a proposed receipt against independent original-parser observations.
 * `observation` must come from the trusted original decoder, never uploaded claims.
 * Current preparation emits header candidates only, so it cannot call this complete.
 */
export function validateReceiptEvidence(proof, observation, context) {
  const reasons = new Set(); const reject = code => reasons.add(code);
  if (!observation) return {status:'incomplete', committable:false, reasons:['independent_original_observation_required']};
  if (!sha(context.sourceSha256) || proof.sourceSha256 !== context.sourceSha256 || observation.sourceSha256 !== context.sourceSha256) reject('source_hash_mismatch');
  if (proof.tenantId !== context.tenantId || observation.tenantId !== context.tenantId) reject('tenant_mismatch');
  const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  if (!equal(proof.header,observation.header)) reject('header_or_ownership_mismatch');
  const header=observation.header;
  if (!header || typeof header.customerCode!=='string' || !header.customerCode || typeof header.receiptNumber!=='string' || !header.receiptNumber || !Number.isSafeInteger(header.terminal) || header.terminal<0 || !Number.isFinite(header.localExcelDate) || header.localExcelDate<=0 || header.localExcelDate>=2958466) reject('incomplete_receipt_identity');
  if (context.masterMatches?.length !== 1 || context.masterMatches[0].tenantId !== context.tenantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(context.masterMatches[0].id??'') || context.masterMatches[0].code !== observation.header?.customerCode || proof.customerId !== context.masterMatches[0]?.id) reject('exact_customer_master_link_required');
  if (!equal(proof.events,observation.events)) reject('original_anchor_value_or_class_mismatch');
  if (!equal(proof.numericCoordinates,observation.numericCoordinates) || !Array.isArray(observation.unrepresentedCoordinates) || observation.unrepresentedCoordinates.length || !Array.isArray(observation.numericCoordinates)) reject('incomplete_numeric_coverage');
  const coords=Array.isArray(observation.numericCoordinates)?observation.numericCoordinates:[];
  const validCoordinate=c=>Array.isArray(c)&&c.length===3&&typeof c[0]==='string'&&c[0]&&Number.isSafeInteger(c[1])&&c[1]>0&&Number.isSafeInteger(c[2])&&c[2]>=0;
  const coordinateKeys=new Set(coords.map(c=>JSON.stringify(c)));
  if(coords.some(c=>!validCoordinate(c))||coordinateKeys.size!==coords.length)reject('invalid_or_duplicate_numeric_coordinates');
  const events=Array.isArray(observation.events)?observation.events:[];
  const anchorKeys=events.map(e=>JSON.stringify(e.amountCoordinate));
  if(new Set(anchorKeys).size!==anchorKeys.length)reject('duplicate_event_amount_anchor');
  const rawCoords=observation.rawNumericCoordinates;
  if(!Array.isArray(rawCoords)||rawCoords.some(c=>!validCoordinate(c))||!equal([...rawCoords].map(c=>JSON.stringify(c)).sort(),[...coords].map(c=>JSON.stringify(c)).sort()))reject('raw_numeric_inventory_mismatch');
  const nonMonetary=observation.nonMonetaryCoordinates;
  if(!Array.isArray(nonMonetary)||nonMonetary.some(c=>!validCoordinate(c)))reject('nonmonetary_anchor_inventory_required');
  else{const represented=[...anchorKeys,...nonMonetary.map(c=>JSON.stringify(c))];if(new Set(represented).size!==represented.length||!equal([...represented].sort(),[...coordinateKeys].sort()))reject('unmapped_or_reused_numeric_anchor');}
  if(events.some(e=>!validCoordinate(e.amountCoordinate)||!coordinateKeys.has(JSON.stringify(e.amountCoordinate))))reject('event_anchor_not_covered');
  if (!Array.isArray(observation.events) || !observation.events.length || observation.events.some(e => !Number.isSafeInteger(e.amountCents) || !['merchandise','tax','rounding','tender','change'].includes(e.kind))) reject('unsupported_or_ambiguous_event');
  if (observation.ambiguities?.length || !Array.isArray(observation.ambiguities)) reject('unresolved_ownership');
  if (!context.timezoneContract || context.timezoneContract.sourceSha256 !== context.sourceSha256 || !context.timezoneContract.zone || context.timezoneContract.authority!=='confirmed_source_configuration' || !sha(context.timezoneContract.evidenceSha256)) reject('timezone_contract_required');
  try { new Intl.DateTimeFormat('en',{timeZone:context.timezoneContract?.zone}).format(0); if(!context.timezoneContract?.zone)reject('timezone_contract_required'); } catch {reject('invalid_timezone_contract');}
  if (!context.overlapDecision || context.overlapDecision.sourceSha256 !== context.sourceSha256 || context.overlapDecision.mode !== 'separate_dated_facts_no_additive_sales') reject('aggregate_overlap_selection_required');
  const key = JSON.stringify(observation.header);
  if (context.existingReceiptKeys?.includes(key)) reject('receipt_already_present');
  if (context.existingSourceHashes?.includes(context.sourceSha256)) reject('source_already_present');
  const sums = {merchandise:0,tax:0,rounding:0,tender:0,change:0};
  for (const event of events) if (event.kind in sums && Number.isSafeInteger(event.amountCents)) sums[event.kind] += event.amountCents;
  const due=sums.merchandise+sums.tax+sums.rounding,paid=sums.tender-sums.change;
  if (!Object.values(sums).every(Number.isSafeInteger) || !Number.isSafeInteger(due) || !Number.isSafeInteger(paid) || due !== paid) reject('unbalanced_original_equation');
  return {status:reasons.size?'incomplete':'review_ready',committable:false,reasons:[...reasons].sort()};
}
