import re
from ideal_journal_rules import resolve_standalone_void_products,promotion_annotation_duplicates,explicit_discount,refund_change_duplicate_correction,redemption_display_mirrors

def _classify_receipt(g,master_matches,key_occurrences):
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
 for e in es:
  if e['kind']not in tenders|{'product','GST','PST','ROUNDING','Change','Points','Total Accumulated Points','Total Savings'}and not explicit_discount(e):reasons.append('unsupported_detail')
 merch=sum(e.get('cents',0)for e in es if e['kind']=='product'or explicit_discount(e));tax=sum(e.get('cents',0)for e in es if e['kind']in ['GST','PST']);rounding=sum(e.get('cents',0)for e in es if e['kind']=='ROUNDING');tender=sum(e.get('cents',0)for e in es if e['kind']in tenders)-sum(e.get('cents',0)for e in es if e['kind']=='Change')
 # Review-only interpretation of a distinct redemption payment. An accrual
 # pair alone or an unexplained balancing residual is never a payment.
 unpaired=[i for i,e in enumerate(es) if e['kind']=='Points' and not(i+1<len(es) and es[i+1]['kind']=='Total Accumulated Points')]
 points_tender=False
 if len(unpaired)==1:
  i=unpaired[0];e=es[i];pairs=[j for j in range(i-1) if es[j]['kind']=='Points' and es[j+1]['kind']=='Total Accumulated Points']
  points_tender=(len(pairs)==1 and i>0 and es[i-1]['kind'] in {'Total Accumulated Points','Total Savings'}
   and all(x['kind'] in {'Total Accumulated Points','Total Savings'} for x in es[pairs[0]+1:i])
   and all(x['kind'] in tenders|{'Change'} for x in es[i+1:])
   and e.get('qty')==1 and type(e.get('cents')) is int and e['cents']>0
   and merch+tax+rounding-tender==e['cents'])
  if points_tender:tender+=e['cents']
 if unpaired and not points_tender:reasons.append('unpaired_points_semantics')
 cash=[e for e in es if e['kind']=='CASH'];changes=[e for e in es if e['kind']=='Change']
 other=[e for e in es if e['kind'] in tenders-{'CASH'}]
 # A duplicate Change on a pure cash refund is a repeated display of the
 # refund, not a second signed tender. The original cash itself must balance.
 if not points_tender and len(cash)==len(changes)==1 and not other and not any(e['kind']=='ROUNDING' for e in es):
  correction=refund_change_duplicate_correction(merch,tax,rounding,0,cash[0].get('cents'),changes[0].get('cents'))
  if correction is not None:tender+=correction
 # Free merchandise remains searchable as zero-value evidence; lack of a
 # tender on an explicitly zero-only product receipt is not a paid visit.
 # All original anchor/layout/identity exclusions still apply upstream.
 zero_only=(merch==tax==rounding==0 and not cash and not other and not changes
  and not any(e['kind'] in tenders for e in es)
  and any(e['kind']=='product' and e.get('qty',0)>0 for e in es)
  and all(e.get('cents')==0 for e in es if e['kind']=='product' or explicit_discount(e)))
 if not any(e['kind']in tenders for e in es) and not points_tender and not zero_only:reasons.append('missing_tender')
 if merch+tax+rounding!=tender:reasons.append('unbalanced_source_equation')
 return sorted(set(reasons)),merch,tax,rounding,tender


def review_receipt(g,master_matches,key_occurrences):
 original=_classify_receipt(g,master_matches,key_occurrences)
 # Never reinterpret a receipt that already passes. Preserve raw events and
 # all independently collected anchor and coverage exclusions in the caller.
 if not original[0]:return original,[]
 omit,proof=redemption_display_mirrors(g['events'])
 if not omit:return original,[]
 proposed={**g,'events':[e for i,e in enumerate(g['events']) if i not in omit]}
 alternate=_classify_receipt(proposed,master_matches,key_occurrences)
 if alternate[0]:return original,[]
 return alternate,proof

def classify_receipt(g,master_matches,key_occurrences):
 return review_receipt(g,master_matches,key_occurrences)[0]
