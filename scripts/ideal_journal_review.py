"""Read-only journal reconciliation inventory. Never emits importable orders.

Run only on evidence produced locally by ideal-journal-source.py and a fresh,
tenant-scoped master snapshot. Counts are review candidates, not certified sales.
"""
import argparse
import collections
import hashlib
import json
import math
import uuid


def receipt_rows(path):
    with open(path) as source:
        for line in source:
            row = json.loads(line).get('normalized', {})
            if row.get('kind') == 'receipt_evidence':
                yield row


def identity(row):
    fields = row['fields']
    # A conflicting timestamp must not disguise a repeated receipt number.
    return (fields.get('terminal'), fields.get('receiptNumber'))


def review(rows_factory, masters, tenant_id):
    master = collections.defaultdict(list)
    for record in masters:
        if record.get('tenantId') != tenant_id:
            raise ValueError('Master snapshot contains another tenant')
        uuid.UUID(record['id'])
        if isinstance(record.get('code'), str):
            master[record['code']].append(record['id'])
    keys = collections.Counter(identity(row) for row in rows_factory())
    reasons = collections.Counter()
    counts = collections.Counter()
    totals = collections.Counter()
    for row in rows_factory():
        counts['receiptCandidates'] += 1
        fields = row['fields']
        exclusions = set()
        for name in ('sourceFinancialExclusions', 'originalAnchorErrors', 'ambiguities'):
            if not isinstance(fields.get(name), list):
                exclusions.add('missing_original_evidence')
            else:
                exclusions.update(fields[name])
        coverage = fields.get('sourceCoverage', {})
        for name in ('unrepresentedNumericCoordinates', 'unownedNumericCoordinates'):
            if not isinstance(coverage.get(name), list) or coverage[name]:
                exclusions.add('incomplete_numeric_coverage')
        if fields.get('pageBoundaryProvenance') != 'original_biff_horizontal_breaks_and_continue':
            exclusions.add('original_page_provenance_required')
        terminal, number = identity(row)
        if not isinstance(terminal, (int, float)) or isinstance(terminal, bool) or not math.isfinite(terminal) or terminal < 0 or terminal != int(terminal) or not isinstance(number, str) or not number:
            exclusions.add('invalid_receipt_identity')
        if keys[identity(row)] != 1:
            exclusions.add('duplicate_receipt_identity')
        matches = master.get(row.get('customerCode'), [])
        if len(matches) != 1:
            exclusions.add('exact_customer_master_link_required')
        equation = fields.get('sourceEquation', {})
        values = [equation.get(k) for k in ('merchandiseCents', 'taxCents', 'roundingCents', 'netTenderCents')]
        if not all(type(v) is int for v in values):
            exclusions.add('missing_integer_equation')
        elif sum(values[:3]) != values[3]:
            exclusions.add('unbalanced_source_equation')
        if exclusions:
            counts['excludedCandidates'] += 1
            reasons.update(exclusions)
        else:
            counts['sourceAndIdentityReviewCandidates'] += 1
            bucket = 'negative' if values[0] < 0 else 'positive' if values[0] > 0 else 'zero'
            counts[bucket + 'Candidates'] += 1
            totals[bucket + 'MerchandiseCents'] += values[0]
    return {
        'version': 1, 'tenantId': tenant_id, 'committable': False,
        'mode': 'separate_dated_facts_no_additive_sales',
        'counts': dict(counts), 'reviewCandidateAmounts': dict(totals),
        'exclusions': dict(sorted(reasons.items())),
        'requiredBeforeImport': ['confirmed_source_timezone', 'refund_and_void_semantics_review',
            'per_customer_summary_reconciliation', 'overlap_and_source_selection_contract',
            'coverage_certification', 'independent_original_evidence_validation'],
        'metricRestrictions': ['Do not add journal amounts to imported period totals.',
            'Partial candidates do not establish complete visits, first purchase, or lapsed status.',
            'Current-year receipts do not establish prior-year dated comparison coverage.'],
    }


def digest(path):
    value = hashlib.sha256()
    with open(path, 'rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--evidence', required=True)
    parser.add_argument('--original', required=True)
    parser.add_argument('--master', required=True)
    parser.add_argument('--tenant', required=True)
    args = parser.parse_args()
    with open(args.master) as source:
        masters = json.load(source)
    result = review(lambda: receipt_rows(args.evidence), masters, args.tenant)
    result['inputHashes'] = {name: digest(getattr(args, name)) for name in ('original', 'evidence', 'master')}
    print(json.dumps(result, indent=2))
