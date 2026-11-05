"""Older IdealPOS journal layout (2019-2020): read each printed page down the
left column, then down the right column.

Differences from the 2021+ layout handled here:
- Customer headings ("Name     CODE") appear in either column.
- Right-column lines move between three column positions (label at J, K or M),
  so a line is accepted only where a text label has a quantity 4 columns
  right and an amount 6 columns right (both required) (Change carries its amount 4 right).
- Card tenders print as VISA, MASTERCARD, DEBIT and AMEX; frequent-buyer
  rewards as FREQ. BUYER; web orders pay ONLINE with GST/PST Amount tax lines.

Output: one JSON line per receipt in the format ideal_journal_lines.py reads
({'normalized': {'customerCode', 'fields': {'header', 'events'}}}).
"""
import collections
import json
import os
import re
import sys

import xlrd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('IDEAL_JOURNAL_OPERATOR', '1')
from ideal_journal_pages import horizontal_breaks  # noqa: E402

HEAD = re.compile(r'^(.+?)\s{5}(\S+)\s*$')
FINANCIAL = {'GST', 'PST', 'HST', 'ROUNDING', 'Points', 'Total Accumulated Points', 'Total Savings',
             'CASH', 'DEBIT/CREDIT', 'SA', 'GIFT CARD', 'CREDIT NOTE', 'ONLINE GIFT CARD', 'PROMOTIONAL',
             'CHEQUE', 'VISA', 'MASTERCARD', 'DEBIT', 'AMEX', 'AMERICAN EXPRESS',
             # Frequent-buyer rewards and web orders pay with these; web orders print tax this way.
             'FREQ. BUYER', 'FREQ BUYER', 'ONLINE', 'E-TRANSFER',
             'GST Amount', 'PST Amount', 'GST Subtotal', 'PST Subtotal'}
WIDTH = 19
SIDES = {0: {'heading': (0,), 'header': (0,), 'detail': (2,)},
         1: {'heading': (9, 10), 'header': (7, 8, 10), 'detail': (9, 10, 11, 12)}}


def number(v):
    return isinstance(v, float) and not isinstance(v, bool)


def text(v):
    return isinstance(v, str) and v != ''


def side_cells(row, side):
    """Columns that belong to this side. A number in column I (8) is the left
    amount unless it starts a right-column receipt header; text there is a
    right-side product code."""
    # A right-column receipt header can start in column I: date I, terminal K, number L.
    right_header_at_i = number(row[8]) and number(row[10]) and text(row[11])
    out = {}
    for c, v in enumerate(row):
        if v == '':
            continue
        if c < 7 or (c == 8 and number(v) and not right_header_at_i):
            if side == 0:
                out[c] = v
        elif side == 1:
            out[c] = v
    return out


def parse_row(row, side):
    cells = side_cells(row, side)
    cell = lambda c: cells.get(c, '')
    spec = SIDES[side]
    for c in spec['heading']:
        v = cell(c)
        if text(v) and HEAD.match(v) and not any(number(cell(x)) for x in range(c + 1, c + 9)):
            return ('heading', HEAD.match(v)[2])
    for c in spec['header']:
        if number(cell(c)) and 20000 < cell(c) < 80000 and text(cell(c + 3)) and number(cell(c + 2)):
            return ('header', cell(c), cell(c + 2), cell(c + 3), c)
    for d in spec['detail']:
        label = cell(d)
        if not text(label):
            continue
        if label == 'Change':
            # The J:M label merge leaves N blank, so a column-J Change has its amount in O.
            amount = next((cell(c) for c in ((d + 4, d + 5) if d == 9 else (d + 4,)) if number(cell(c))), None)
            if amount is not None:
                return ('change', round(amount * 100), d)
        if not (number(cell(d + 4)) and number(cell(d + 6))):
            continue
        before = [cell(d - 1), cell(d - 2)]
        void = 'VOID' in before
        code = cell(d - 2) if text(cell(d - 2)) and cell(d - 2) != 'VOID' else ''
        qty = cell(d + 4)
        return ('detail', label, code, qty, round(cell(d + 6) * 100), void, d)
    if any(v == 'VOID' for v in cells.values()):
        return ('void',)
    return None


def events_for(path):
    w = xlrd.open_workbook(path, on_demand=True)
    breaks = horizontal_breaks(w.mem[:w.stream_len], w._sh_abs_posn)
    for si, sn in enumerate(w.sheet_names()):
        s = w.sheet_by_name(sn)
        rows = [(s.row_values(i) + [''] * WIDTH)[:WIDTH] for i in range(s.nrows)]
        bounds = [0] + [b for b in sorted(set(breaks[si])) if 0 < b < s.nrows] + [s.nrows]
        for p in range(len(bounds) - 1):
            for side in (0, 1):
                for i in range(bounds[p], bounds[p + 1]):
                    parsed = parse_row(rows[i], side)
                    if parsed:
                        yield parsed, sn, i + 1, side
        w.unload_sheet(sn)


def receipts(path):
    customer = None
    current = None
    pending_void = None
    stats = collections.Counter()
    for parsed, sn, row, side in events_for(path):
        kind = parsed[0]
        if kind == 'heading':
            customer = parsed[1]
            continue
        if kind == 'header':
            if current:
                yield current
            _, date, terminal, receipt, col = parsed
            current = {'code': customer, 'header': {'date': date, 'terminal': terminal, 'number': receipt,
                                                     'sheet': sn, 'row': row, 'column': col, 'code': customer},
                       'events': []}
            pending_void = None
            continue
        if current is None:
            stats['orphan'] += 1
            continue
        base = {'sheet': sn, 'row': row, 'col': parsed[-1]}
        if kind == 'void':
            pending_void = dict(base, kind='standalone_void')
            continue
        if kind == 'change':
            current['events'].append(dict(base, kind='Change', cents=parsed[1]))
            continue
        _, label, code, qty, cents, void, _d = parsed
        if void:
            current['events'].append(dict(base, kind='voided_detail', cents=cents, qty=qty, label=label))
            continue
        if label in FINANCIAL:
            ev = dict(base, kind=label, cents=cents, qty=qty, label=label)
        elif code:
            ev = dict(base, kind='product', cents=cents, qty=qty, label=label, description=label, sourceCode=code,
                      creditIssue=bool(re.match(r'^CREDIT NOTE(?:\s*:|$)', label)),
                      giftIssue=bool(re.match(r'^(?:ONLINE )?GIFT CARD(?:\s*:|$)', label)))
        elif label.startswith('COUPON:'):
            ev = dict(base, kind='coupon', cents=cents, qty=qty, label=label)
        else:
            ev = dict(base, kind='discount', cents=cents, qty=qty, label=label, description=label)
        if pending_void:
            ev['precedingStandaloneVoid'] = pending_void
            pending_void = None
        current['events'].append(ev)
    if current:
        yield current
    sys.stderr.write(json.dumps(dict(stats)) + '\n')


if __name__ == '__main__':
    with open(sys.argv[2], 'w') as out:
        n = 0
        for r in receipts(sys.argv[1]):
            n += 1
            out.write(json.dumps({'normalized': {'customerCode': r['code'],
                                                 'fields': {'header': r['header'], 'events': r['events']}}},
                                 separators=(',', ':')) + '\n')
    print(n)
