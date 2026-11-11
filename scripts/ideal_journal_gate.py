import re
from ideal_journal_rules import resolve_standalone_void_products,promotion_annotation_duplicates,explicit_discount

def classify_receipt(g,master_matches,key_occurrences):
 tenders={'CASH','DEBIT/CREDIT','SA','GIFT CARD','CREDIT NOTE','ONLINE GIFT CARD','PROMOTIONAL','CHEQUE'}
 r=g['receipt'];reasons=[]
 if master_matches!=1:reasons.append('unmatched_or_duplicate_master_code')
 if key_occurrences!=1:reasons.append('duplicate_receipt_key')
 es,amb,_=resolve_standalone_void_products(g)
 if amb:reasons.append('unresolved_layout')
 es=[e for e in es if e['kind']!='voided_detail'];omit,_=promotion_annotation_duplicates(es)
 annotated={i for i,e in enumerate(es)if e['kind']=='product'and re.match(r'^-?\d[\d,]*\.\d{2} {2}',e.get('description',''))}
 if annotated-set(omit):reasons.append('unmatched_annotation_coordinates')
 es=[e for i,e in enumerate(es)if i not in omit]
 if any(e.get('creditIssue')or e.get('giftIssue')for e in es):reasons.append('issuance_semantics')
 for i,e in enumerate(es):
  if e['kind']=='Points'and not(i+1<len(es)and es[i+1]['kind']=='Total Accumulated Points'):reasons.append('unpaired_points_semantics')
  if e['kind']not in tenders|{'product','GST','PST','ROUNDING','Change','Points','Total Accumulated Points','Total Savings'}and not explicit_discount(e):reasons.append('unsupported_detail')
 merch=sum(e.get('cents',0)for e in es if e['kind']=='product'or explicit_discount(e));tax=sum(e.get('cents',0)for e in es if e['kind']in ['GST','PST']);rounding=sum(e.get('cents',0)for e in es if e['kind']=='ROUNDING');tender=sum(e.get('cents',0)for e in es if e['kind']in tenders)-sum(e.get('cents',0)for e in es if e['kind']=='Change')
 if not any(e['kind']in tenders for e in es):reasons.append('missing_tender')
 if merch+tax+rounding!=tender:reasons.append('unbalanced_source_equation')
 return sorted(set(reasons)),merch,tax,rounding,tender
