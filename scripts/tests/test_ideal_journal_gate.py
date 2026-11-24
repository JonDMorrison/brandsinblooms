import unittest
from ideal_journal_gate import classify_receipt
class ReceiptGateTests(unittest.TestCase):
 def group(self):return {'receipt':{'code':'001','number':'SYNTH','terminal':1,'date':46000.5},'events':[{'kind':'product','cents':1000,'qty':1},{'kind':'GST','cents':50},{'kind':'CASH','cents':1050}],'ambiguities':[]}
 def test_source_balanced_sale_passes(self):self.assertEqual(classify_receipt(self.group(),1,1)[0],[])
 def test_identity_duplicate_and_layout_fail_closed(self):
  g=self.group();self.assertIn('unmatched_or_duplicate_master_code',classify_receipt(g,0,1)[0]);self.assertIn('duplicate_receipt_key',classify_receipt(g,1,2)[0]);g['ambiguities']=['unresolved'];self.assertIn('unresolved_layout',classify_receipt(g,1,1)[0])
 def test_one_cent_mismatch_not_rounded_to_fit(self):
  g=self.group();g['events'][-1]['cents']=1051;self.assertIn('unbalanced_source_equation',classify_receipt(g,1,1)[0])
 def test_unknown_points_and_issuance_never_certified_by_balance(self):
  g=self.group();g['events'].append({'kind':'Points','cents':0});self.assertIn('unpaired_points_semantics',classify_receipt(g,1,1)[0]);g['events'][0]['giftIssue']=True;self.assertIn('issuance_semantics',classify_receipt(g,1,1)[0])
 def test_unmatched_annotation_not_hidden_by_balancing(self):
  g=self.group();g['events'][0].update(description='10.00  Unmatched promotion',sourceCode='SYNTH')
  self.assertIn('unmatched_annotation_coordinates',classify_receipt(g,1,1)[0])
 def test_distinct_points_payment_requires_exact_shape_and_amount(self):
  g=self.group();g['events']=g['events'][:2]+[{'kind':'Points','cents':100,'qty':1},{'kind':'Total Accumulated Points','cents':200,'qty':1},{'kind':'Total Savings','cents':0,'qty':1},{'kind':'Points','cents':300,'qty':1},{'kind':'CASH','cents':750}]
  self.assertEqual(classify_receipt(g,1,1),([],1000,50,0,1050))
  for value,quantity in [(299,1),(300,2),(0,1)]:
   g['events'][-2].update(cents=value,qty=quantity)
   self.assertIn('unpaired_points_semantics',classify_receipt(g,1,1)[0])
  g['events'][-2].update(cents=300,qty=1)
  g['events'].insert(-1,{'kind':'Total Savings','cents':0,'qty':1})
  self.assertIn('unpaired_points_semantics',classify_receipt(g,1,1)[0])
 def test_points_only_payment_and_missing_accrual_pair(self):
  g=self.group();g['events']=g['events'][:2]+[{'kind':'Points','cents':100,'qty':1},{'kind':'Total Accumulated Points','cents':200,'qty':1},{'kind':'Points','cents':1050,'qty':1}]
  self.assertEqual(classify_receipt(g,1,1),([],1000,50,0,1050))
  del g['events'][2:4]
  self.assertIn('unpaired_points_semantics',classify_receipt(g,1,1)[0])
 def test_explicit_zero_products_without_tender_are_zero_evidence(self):
  g=self.group();g['events']=[{'kind':'product','cents':0,'qty':1}]
  self.assertEqual(classify_receipt(g,1,1),([],0,0,0,0))
  g['events'].append({'kind':'product','cents':100,'qty':1})
  g['events'].append({'kind':'product','cents':-100,'qty':-1})
  self.assertIn('missing_tender',classify_receipt(g,1,1)[0])
 def test_pure_cash_refund_change_duplicate_is_not_double_counted(self):
  for change in (-1050,1050):
   g=self.group();g['events']=[{'kind':'product','cents':-1000,'qty':-1},{'kind':'GST','cents':-50},{'kind':'CASH','cents':-1050},{'kind':'Change','cents':change}]
   self.assertEqual(classify_receipt(g,1,1),([],-1000,-50,0,-1050))
   g['events'][-1]['cents']=change+1
   self.assertIn('unbalanced_source_equation',classify_receipt(g,1,1)[0])
 def test_exact_redemption_display_mirror_only(self):
  g=self.group()
  g['events']=[{'kind':'product','cents':1000,'qty':1},{'kind':'GST','cents':50},{'kind':'product','description':'Gift Voucher Redemption','sourceCode':'SYNTH','cents':300,'qty':1},{'kind':'GIFT CARD','cents':300},{'kind':'CASH','cents':750}]
  from ideal_journal_gate import review_receipt
  original=[dict(e) for e in g['events']]
  result,proof=review_receipt(g,1,1)
  self.assertEqual(result,([],1000,50,0,1050))
  self.assertEqual(proof,[{'kind':'redemption_display_mirror','displayIndices':[2],'paymentIndex':3}])
  self.assertEqual(g['events'],original)
  self.assertTrue(review_receipt(g,0,1)[0][0])
  g['events'][2]['cents']=299
  self.assertTrue(review_receipt(g,1,1)[0][0])
  g['events'][2]['cents']=300
  g['events'].insert(4,{'kind':'GIFT CARD','cents':0})
  self.assertTrue(review_receipt(g,1,1)[0][0])
 def test_coupon_display_requires_unique_literal_code_and_amount(self):
  from ideal_journal_gate import review_receipt
  g=self.group()
  g['events']=[{'kind':'product','cents':1000,'qty':1},{'kind':'product','description':'COUPON: SYNTH','sourceCode':'PROMO','cents':-100,'qty':1},{'kind':'product','description':'Promotion','sourceCode':'PROMO','cents':-100,'qty':1},{'kind':'CASH','cents':900}]
  result,proof=review_receipt(g,1,1)
  self.assertEqual(result,([],900,0,0,900))
  self.assertEqual(proof,[{'kind':'coupon_display_mirror','displayIndices':[1],'promotionIndex':2}])
  g['events'][2]['sourceCode']='OTHER'
  self.assertTrue(review_receipt(g,1,1)[0][0])
  g['events'][2]['sourceCode']='PROMO'
  g['events'][1]['anchor_errors']=['missing']
  self.assertTrue(review_receipt(g,1,1)[0][0])
 def test_spending_control_requires_explicit_rounding_and_exact_counts(self):
  from ideal_journal_rules import reconcile_customer_spending_control as reconcile
  rows=[(True,1002,-2),(True,1999,1)]
  self.assertTrue(reconcile(rows,2,3000))
  self.assertFalse(reconcile(rows,2,3001))
  self.assertFalse(reconcile(rows,3,3000))
  self.assertFalse(reconcile([(False,1002,-2),rows[1]],2,3000))
  self.assertFalse(reconcile([(True,1002,0),(True,1999,0)],2,3000))
if __name__=='__main__':unittest.main()
