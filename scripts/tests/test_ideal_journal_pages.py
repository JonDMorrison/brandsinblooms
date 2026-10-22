import unittest,struct
from ideal_journal_pages import horizontal_breaks,page_order
class PageBoundaryTests(unittest.TestCase):
    def record(self,t,b):return struct.pack('<HH',t,len(b))+b
    def test_standard_continue_restores_declared_payload(self):
        payload=struct.pack('<H',2)+struct.pack('<HHH',5,1,256)+struct.pack('<HHH',10,1,256)
        self.assertEqual(horizontal_breaks(self.record(27,payload[:9])+self.record(60,payload[9:])),[[5,10]])
    def test_missing_continue_and_partial_width_fail(self):
        for payload in [struct.pack('<H',2)+struct.pack('<HHH',5,1,256),struct.pack('<H',1)+struct.pack('<HHH',5,2,256)]:
            with self.assertRaises(ValueError):horizontal_breaks(self.record(27,payload))
    def test_page_order_continues_right_receipt_into_next_left_page(self):
        def e(row,kind='product'):return {'sheet':'S','row':row,'kind':kind}
        streams=[[e(2),e(6)],[e(3),e(7)]]
        self.assertEqual([(side,x['row'])for side,x in page_order(streams,{'S':[5]})],[(0,2),(1,3),(0,6),(1,7)])
    def test_last_row_before_break_stays_on_old_page(self):
        def e(row):return {'sheet':'S','row':row,'kind':'product'}
        self.assertEqual([(side,x['row'])for side,x in page_order([[e(5),e(6)],[e(1)]],{'S':[5]})],[(0,5),(1,1),(0,6)])
    def test_trailing_header_rejected(self):
        with self.assertRaises(ValueError):horizontal_breaks(b'\x01')
    def test_duplicate_in_one_sheet_and_missing_in_other_rejected(self):
        record=self.record(27,struct.pack('<H',1)+struct.pack('<HHH',5,1,256))
        raw=record+record+self.record(10,b'')
        with self.assertRaises(ValueError):horizontal_breaks(raw,[0,len(record)*2])
        self.assertEqual(horizontal_breaks(record+record,[0,len(record)]),[[5],[5]])
if __name__=='__main__':unittest.main()
