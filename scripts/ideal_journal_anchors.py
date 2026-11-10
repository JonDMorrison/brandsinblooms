"""Exact raw-anchor validation. No inferred cents or financial semantics."""
from decimal import Decimal, InvalidOperation
from ideal_journal_rules import explicit_discount

def decimal_value(value):
    if isinstance(value,bool) or not isinstance(value,(int,float)):raise ValueError('Non-numeric anchor')
    result=Decimal(str(value))
    if not result.is_finite():raise ValueError('Non-finite anchor')
    return result

def source_money_decimal(value,number_format):
    from math import ulp
    raw=decimal_value(value)
    if ulp(value)>2**-33:raise ValueError('Binary spacing exceeds verified source precision envelope')
    if number_format!='0.00':raise ValueError('Unverified monetary display format')
    displayed=raw.quantize(Decimal('0.01'))
    if abs(float(value)-float(displayed))>ulp(value):raise ValueError('Source amount exceeds binary storage noise')
    return displayed

def validate_event_anchors(event,row,number_formats=None):
    errors=[];col=event['col'];kind=event['kind']
    def cell(c):return row[c] if 0<=c<len(row) else None
    amount_col=col+(5 if col==9 else 4) if kind=='Change' else col+6
    try:
        amount=source_money_decimal(cell(amount_col),(number_formats or {}).get(amount_col))*100
        if amount!=amount.to_integral_value():errors.append('subcent_source_value')
        if amount!=Decimal(str(event.get('cents'))):errors.append('amount_anchor_mismatch')
    except (ValueError,InvalidOperation):errors.append('invalid_amount_anchor')
    if kind!='Change':
        try:
            if decimal_value(cell(col+4))!=decimal_value(event.get('qty')):errors.append('quantity_anchor_mismatch')
        except (ValueError,InvalidOperation):errors.append('invalid_quantity_anchor')
    if kind=='product':
        if cell(col)!=event.get('description')or cell(col-2)!=event.get('sourceCode'):errors.append('product_label_or_code_mismatch')
    elif kind=='discount':
        if cell(col)!=event.get('description')or not explicit_discount(event):errors.append('unverified_discount_label')
    elif kind=='voided_detail':
        if cell(event.get('sourceVoidColumn',-999))!='VOID':errors.append('missing_void_marker')
    elif kind in {'unclassified','coupon','unresolved_change'}:errors.append('unsupported_semantic_class')
    elif cell(col)!=kind:errors.append('financial_label_mismatch')
    return sorted(set(errors))
