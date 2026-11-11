"""Private source-layout diagnostics. No persistence or import operations."""
import math

def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)

def inline_void_description(row, marker_column):
    def value(c):
        return row[c] if 0 <= c < len(row) else None
    if value(marker_column) != 'VOID':
        return None
    candidates = [c for c in (marker_column + 1, marker_column + 2)
                  if isinstance(value(c), str) and value(c)
                  and number(value(c + 4)) and number(value(c + 6))]
    return candidates[0] if len(candidates) == 1 else None

def change_amount(row, label_column):
    if label_column >= len(row) or row[label_column] != 'Change':
        return None
    # Source-backed alternate J:M label merge leaves N blank; amount is O.
    amount_column = label_column + (5 if label_column == 9 else 4)
    if amount_column >= len(row) or not number(row[amount_column]):
        return None
    return row[amount_column]

def implicit_cash_rounding_correction(merchandise_cents, tax_cents, other_tender_cents, cash_less_change_cents):
    if not all(isinstance(v, int) for v in (merchandise_cents, tax_cents, other_tender_cents, cash_less_change_cents)):
        return None
    due = merchandise_cents + tax_cents - other_tender_cents
    difference = cash_less_change_cents - due
    if cash_less_change_cents % 5 or not 0 < abs(difference) <= 2:
        return None
    if cash_less_change_cents != ((due + 2) // 5) * 5:
        return None
    return -difference

def promotion_annotation_duplicates(events):
    """Identify summed duplicate presentations, never infer from customer residuals.

    Omit annotated per-item presentations only when one later unannotated row
    has the exact code/description and equals their full signed amount sum.
    """
    import re
    from decimal import Decimal
    groups = {}
    for i, e in enumerate(events):
        if e.get('kind') != 'product' or e.get('qty') != 1:
            continue
        match = re.fullmatch(r'(-?\d[\d,]*\.\d{2}) {2}(.+)', e.get('description', ''))
        if not match or int(Decimal(match[1].replace(',', '')) * 100) != e['cents']:
            continue
        groups.setdefault((e.get('sourceCode'), match[2]), []).append(i)
    omit = set()
    proofs = []
    for (code, description), indices in groups.items():
        plain = [i for i, e in enumerate(events)
                 if e.get('kind') == 'product' and e.get('sourceCode') == code
                 and e.get('description') == description and isinstance(e.get('qty'), (int,float))
                 and e['qty'] >= 1 and float(e['qty']).is_integer()]
        if len(plain) != 1 or plain[0] <= max(indices):
            continue
        if events[plain[0]]['cents'] != sum(events[i]['cents'] for i in indices):
            continue
        omit.update(indices)
        proofs.append({'annotations': indices, 'summary': plain[0]})
    return omit, proofs

def refund_change_duplicate_correction(merchandise_cents, tax_cents, rounding_cents, other_tender_cents, cash_cents, change_cents):
    values=(merchandise_cents,tax_cents,rounding_cents,other_tender_cents,cash_cents,change_cents)
    if not all(isinstance(v,int) for v in values):return None
    if merchandise_cents>=0 or cash_cents>=0 or abs(change_cents)!=abs(cash_cents) or other_tender_cents!=0:return None
    if merchandise_cents+tax_cents+rounding_cents!=cash_cents:return None
    # Equal-magnitude Change repeats the source-balanced refund, either display sign.
    return change_cents

def reconcile_corrections(base_residuals, corrections, benchmark_codes):
    codes=set(benchmark_codes)
    if not set(base_residuals).issubset(codes):
        raise ValueError('Residual baseline contains identities outside benchmark')
    residuals={c:base_residuals.get(c,0)+corrections.get(c,0) for c in codes}
    residuals={c:v for c,v in residuals.items() if v}
    outside={c:v for c,v in corrections.items() if c not in codes and v}
    return residuals,outside

def resolve_standalone_void_products(group):
    """Resolve only direct same-column marker/product relationships in this export.

    Source marker is in the product CODE column; its next detail is the
    description two columns right, 1–4 source rows later. Cross-column wraps,
    financial details and repeated markers remain ambiguous.
    """
    events=[];unresolved=False;resolved=0
    for original in group['events']:
        e=dict(original);marker=e.get('precedingStandaloneVoid')
        if marker:
            certain=(e['kind']=='product' and e['sheet']==marker['sheet']
                     and e['col']==marker['col']+2 and 1<=e['row']-marker['row']<=4)
            if certain:e['kind']='voided_detail';resolved+=1
            else:unresolved=True
        events.append(e)
    ambiguities=[a for a in group['ambiguities'] if a!='standalone_void_relationship' or unresolved]
    return events,ambiguities,resolved


def explicit_return_net(events):
    """Restricted credit-note return; signed explicit percentage discounts count once."""
    import re
    if not any(e.get('creditIssue') for e in events): return None
    products = [e for e in events if e['kind']=='product' and not e.get('creditIssue')]
    if not products or any(e.get('giftIssue') for e in events): return None
    for e in events:
        if e['kind']=='discount':
            if not explicit_discount(e): return None
        elif e['kind'] not in {'product','Points','Total Accumulated Points','Total Savings'}: return None
    net=sum(e['cents'] for e in products)+sum(e['cents'] for e in events if e['kind']=='discount')
    return net if net<0 else None


def explicit_discount(e):
    import re
    text=e.get('description','')
    m=re.fullmatch(r'(\d+(?:\.\d+)?)% General Discount :(\d+(?:\.\d+)?)% Item Discount',text)
    if m: return e.get('kind')=='discount' and m[1]==m[2] and 0<float(m[1])<=100
    m=re.fullmatch(r'(\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)% DISCOUNT :(\d+(?:\.\d+)?)% Item Discount',text)
    return e.get('kind')=='discount' and bool(m and m[1]==m[2]==m[3] and 0<float(m[1])<=100)


def unresolved_void_boundary(group, marker, boundary):
    """Retain unmatched marker; it must never disappear at a parsing boundary."""
    if marker is None: return False
    if group is None: raise ValueError('Unowned VOID must remain an orphan')
    group['ambiguities'].append('unresolved_void_at_'+boundary)
    group.setdefault('unresolvedMarkers', []).append(dict(marker, boundary=boundary))
    return True


def source_change_event(row, column, sheet, source_row):
    amount=change_amount(row,column)
    event={'sheet':sheet,'row':source_row,'col':column,'ownershipExactHeading':True}
    if amount is None:
        event.update(kind='unresolved_change',reason='unsupported_or_missing_amount')
    else: event.update(kind='Change',cents=round(amount*100))
    return event
