import unittest,math
from decimal import Decimal
from ideal_journal_anchors import source_money_decimal,validate_event_anchors
class AnchorValueTests(unittest.TestCase):
 def test_display_cents_and_one_ulp_binary_artifact(self):
  self.assertEqual(source_money_decimal(24.990000000000002,'0.00'),Decimal('24.99'))
  self.assertEqual(source_money_decimal(6.890000000000001,'0.00'),Decimal('6.89'))
  self.assertEqual(source_money_decimal(-24.990000000000002,'0.00'),Decimal('-24.99'))
  self.assertEqual(source_money_decimal(999999.99,'0.00'),Decimal('999999.99'))
 def test_real_subcent_and_unknown_format_rejected(self):
  for value,fmt in [(1.001,'0.00'),(1.005,'0.00'),(1.00,'General'),(float('inf'),'0.00'),(-1.005,'0.00'),(-1.001,'0.00'),(1e15,'0.00'),((2**44)+0.00390625,'0.00'),(9999999.99,'0.00')]:
   with self.assertRaises(ValueError):source_money_decimal(value,fmt)
 def test_amount_quantity_and_label_must_match(self):
  e={'kind':'product','col':2,'sheet':'S','row':1,'sourceCode':'SKU','description':'Synthetic','qty':1,'cents':100};row=['SKU','','Synthetic','','','',1,'',1.0]
  self.assertEqual(validate_event_anchors(e,row,{8:'0.00'}),[])
  row[8]=1.01;self.assertIn('amount_anchor_mismatch',validate_event_anchors(e,row,{8:'0.00'}))
  row[6]=2;self.assertIn('quantity_anchor_mismatch',validate_event_anchors(e,row,{8:'0.00'}))
  row[2]='Other';self.assertIn('product_label_or_code_mismatch',validate_event_anchors(e,row,{8:'0.00'}))
if __name__=='__main__':unittest.main()
