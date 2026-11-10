import unittest
from ideal_journal_geometry import numeric_anchor_side
class GeometryTests(unittest.TestCase):
 def test_left_void_without_description_is_still_owned_but_quarantined(self):
  row=['']*20;row[0]='VOID';row[5]=1;row[7]=17.97
  self.assertEqual(numeric_anchor_side(row,7),0)
 def test_flexible_right_description_does_not_become_left(self):
  row=['']*20;row[9]='GST';row[13]=1;row[15]=1.23
  self.assertEqual(numeric_anchor_side(row,15),1)
 def test_unexplained_early_column_anchor_is_unowned(self):
  row=['']*20;row[7]=46027.5;row[9]=1
  self.assertIsNone(numeric_anchor_side(row,7))
if __name__=='__main__':unittest.main()
