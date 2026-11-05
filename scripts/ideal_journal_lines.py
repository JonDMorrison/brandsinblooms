"""Turn decoded journal receipts into net product lines.
Rules (Bryan, 2026-11-04): VOID marks the next item row as void -> excluded.
REFUND lines carry '*REFUND*' and negative qty/amount -> kept as negative lines.
Per-item discount annotations ('-1.20  label') are allocated to the item above;
the matching summary discount line is then skipped. Unallocated discounts stay
as their own receipt-level lines. Gift card / credit note issuance is not merchandise."""
import json,re,sys,collections
ANN=re.compile(r'^(-?\d[\d,]*\.\d{2}) {2}(.+)$')
# 2019-2020 layout: card tenders VISA/MASTERCARD/DEBIT/AMEX, FREQ. BUYER rewards,
# web orders paid ONLINE with 'GST Amount'/'PST Amount' tax lines, and E-TRANSFER.
TENDER={'CASH','DEBIT/CREDIT','SA','GIFT CARD','CREDIT NOTE','ONLINE GIFT CARD','PROMOTIONAL','CHEQUE','VISA','MASTERCARD','DEBIT','AMEX','AMERICAN EXPRESS','FREQ. BUYER','FREQ BUYER','ONLINE','E-TRANSFER'}
NONMERCH={'GST','PST','HST','GST Amount','PST Amount','GST Subtotal','PST Subtotal','ROUNDING','Change','Points','Total Accumulated Points','Total Savings','unresolved_change'}|TENDER
def receipt_lines(f):
  ev=f['events'];out=[];stats=collections.Counter();ann_by_label=collections.defaultdict(int)
  void_next=False;last=None
  for e in ev:
    k=e['kind'];label=e.get('label') or e.get('description') or ''
    if k=='voided_detail':stats['void_inline']+=1;stats['void_cents']+=e.get('cents',0);continue
    if e.get('precedingStandaloneVoid'):void_next=True
    if k in NONMERCH:
      if void_next and k not in ('Points','Total Accumulated Points','Total Savings'):stats['void_marker_before_nonmerch']+=1;void_next=False
      continue
    if void_next:
      void_next=False;stats['void_marker']+=1;stats['void_cents']+=e.get('cents',0);continue
    if e.get('giftIssue') or e.get('creditIssue'):stats['issuance']+=1;stats['issuance_cents']+=e['cents'];continue
    if label.startswith('COUPON:') or k=='coupon':stats['coupon']+=1;stats['coupon_cents']+=e.get('cents',0);continue
    if re.match(r'^(Gift Voucher|Credit Note) Redemption',label):stats['voucher']+=1;stats['voucher_cents']+=e.get('cents',0);continue
    cents=e.get('cents',0);m=ANN.match(label)
    if m and (k!='product' or True) and int(round(float(m[1].replace(',',''))*100))==cents:
      key=m[2].strip()
      ann_by_label[key]+=cents
      if last is not None:last['net_cents']+=cents;last['discount_cents']+=cents;stats['ann_alloc']+=1
      else:out.append({'code':e.get('sourceCode'),'name':key,'qty':0,'net_cents':cents,'discount_cents':cents,'gross_cents':0,'kind':'discount','src':[e['sheet'],e['row'],e['col']]});stats['ann_unallocated']+=1
      continue
    refund=k=='product' and (re.search(r'\s\*REF[A-Z]*\*?$',label) is not None or (isinstance(e.get('qty'),(int,float)) and e['qty']<0))
    if k=='product' and not m and not refund and cents>0 and ann_by_label.get(label.strip())==cents:
      # Positive multi-buy adjustment ('0.15  Seed Geranium 18 for $24.99') already
      # added to the item above; its summary line repeats the same amount.
      ann_by_label[label.strip()]=0;stats['plain_skipped']+=1;continue
    if k=='product' and (cents>=0 or refund) and not m:
      name=re.sub(r'\s+\*REF[A-Z]*\*?$','',label).strip()
      dm=re.search(r'\s\((\d+)\)$',name)
      if dm:name=name[:dm.start()].strip()
      last={'code':e.get('sourceCode'),'name':name,'qty':e.get('qty'),'net_cents':cents,'gross_cents':cents,'discount_cents':0,'kind':'refund' if refund else 'item','src':[e['sheet'],e['row'],e['col']]}
      out.append(last);continue
    # plain discount/promo line (negative product w/ promo code, discount, unclassified)
    if cents==0:stats['zero_line']+=1;continue
    low=label.lower().strip()
    covered=[l for l in ann_by_label if ann_by_label[l] and (low.startswith(l.lower().strip()) or l.lower().strip().startswith(low))]
    if covered and sum(ann_by_label[l] for l in covered)==cents:
      for l in covered:ann_by_label[l]=0
      stats['plain_skipped']+=1;continue
    out.append({'code':e.get('sourceCode'),'name':label,'qty':e.get('qty') or 0,'net_cents':cents,'gross_cents':0,'discount_cents':cents,'kind':'discount','src':[e['sheet'],e['row'],e['col']]});stats['plain_kept']+=1
  return out,stats
TAX={'GST','PST','HST','GST Amount','PST Amount','GST Subtotal','PST Subtotal'}
def receipt_balances(f):
  """merchandise + tax + rounding = payments - change. A Points line after Total
  Accumulated Points is a points redemption paid in dollars; a GIFT CARD line before
  the tax lines is a gift card sold; store credit or gift cards issued are not payments."""
  ev=f['events'];lines,_=receipt_lines(f);m=sum(l['net_cents'] for l in lines)
  t=sum(e['cents'] for e in ev if e['kind'] in TAX);r=sum(e['cents'] for e in ev if e['kind']=='ROUNDING')
  p=sum(e['cents'] for e in ev if e['kind'] in TENDER);ch=sum(e['cents'] for e in ev if e['kind']=='Change')
  seen_tap=taxed=False
  for e in ev:
    if e['kind'] in TAX:taxed=True
    if e['kind'] in ('GIFT CARD','ONLINE GIFT CARD') and not taxed:p-=2*e['cents']
    if e['kind']=='Total Accumulated Points':seen_tap=True
    elif e['kind']=='Points' and seen_tap:p+=e['cents'];seen_tap=False
    if e.get('creditIssue') or e.get('giftIssue'):p-=e['cents']
  return m+t+r in (p-ch,p+ch,p)
if __name__=='__main__':
  import os
  # 2019-2020 operator gate: an unbalanced receipt keeps its date, never its product lines.
  GATE=os.environ.get('IDEAL_JOURNAL_BALANCE_GATE')=='1'
  tot=collections.Counter();per=collections.Counter();n=0
  w=open(sys.argv[2],'w')
  for line in open(sys.argv[1]):
    d=json.loads(line)
    if 'normalized' not in d:continue
    f=d['normalized']['fields'];code=d['normalized']['customerCode'];h=f['header']
    lines,st=receipt_lines(f);tot.update(st);n+=1
    if GATE and not receipt_balances(f):tot['gated_receipts']+=1;tot['gated_cents']+=sum(l['net_cents'] for l in lines);lines=[]
    s=sum(l['net_cents'] for l in lines);per[code]+=s;tot['merch_cents']+=s;tot['lines']+=len(lines)
    w.write(json.dumps({'code':code,'date':h['date'],'terminal':h['terminal'],'number':h['number'],'src':[h['sheet'],h['row'],h['column']],'lines':lines},separators=(',',':'))+'\n')
  json.dump(per,open(sys.argv[2]+'.percustomer.json','w'))
  print(n,dict(tot),len(per))
