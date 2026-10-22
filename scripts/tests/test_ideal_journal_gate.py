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
if __name__=='__main__':unittest.main()
