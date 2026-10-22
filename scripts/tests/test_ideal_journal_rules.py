import unittest
from ideal_journal_rules import inline_void_description, change_amount, implicit_cash_rounding_correction

class CoordinateRulesTests(unittest.TestCase):
    def test_inline_right_void_uses_same_row_l_p_r(self):
        row=['']*20;row[10]='VOID';row[11]='cancelled synthetic item';row[15]=1;row[17]=-12.50
        self.assertEqual(inline_void_description(row,10),11)
        next_row=['']*20;next_row[10]='DEBIT/CREDIT';next_row[14]=1;next_row[16]=50
        self.assertIsNone(inline_void_description(next_row,10))

    def test_standalone_void_does_not_cancel_next_tender(self):
        row=['']*20;row[10]='VOID'
        self.assertIsNone(inline_void_description(row,10))
        # A numeric tender in a different row cannot complete the marker's row.
        next_row=['']*20;next_row[10]='DEBIT/CREDIT';next_row[14]=1;next_row[16]=24
        self.assertIsNone(inline_void_description(next_row,10))

    def test_inline_left_void_and_ambiguous_row(self):
        row=['']*10;row[0]='VOID';row[2]='synthetic item';row[6]=-1;row[8]=-20
        self.assertEqual(inline_void_description(row,0),2)
        row[1]='second candidate';row[5]=1;row[7]=3
        self.assertIsNone(inline_void_description(row,0))

    def test_change_alternate_column_not_next_numeric_guess(self):
        row=['']*20;row[9]='Change';row[14]=6.55;row[15]=999
        self.assertEqual(change_amount(row,9),6.55)
        row[14]=''
        self.assertIsNone(change_amount(row,9))

    def test_standard_change_and_nonfinite_rejected(self):
        row=['']*12;row[2]='Change';row[6]=1.25
        self.assertEqual(change_amount(row,2),1.25)
        row[6]=float('inf');self.assertIsNone(change_amount(row,2))

    def test_rounding_uses_source_payment_balance(self):
        # Merchandise19.96 + tax2.40 - points8 => unrounded cash14.36; cash15 less change.65.
        self.assertEqual(implicit_cash_rounding_correction(1996,240,800,1435),1)
        self.assertEqual(implicit_cash_rounding_correction(1001,0,0,1000),1)
        self.assertEqual(implicit_cash_rounding_correction(1003,0,0,1005),-2)

    def test_rounding_rejects_arbitrary_penny_and_large_adjustment(self):
        self.assertIsNone(implicit_cash_rounding_correction(1000,0,0,1001))
        self.assertIsNone(implicit_cash_rounding_correction(1000,0,0,1005))
        self.assertIsNone(implicit_cash_rounding_correction(1000,0,0,1000))
        self.assertIsNone(implicit_cash_rounding_correction(1000.0,0,0,1000))


class PromotionPresentationTests(unittest.TestCase):
    def event(self,description,cents,code='PROMO'):
        return {'kind':'product','qty':1,'sourceCode':code,'description':description,'cents':cents}
    def test_exact_signed_sum_and_later_summary(self):
        from ideal_journal_rules import promotion_annotation_duplicates
        es=[self.event('4.80  Synthetic promotion',480),self.event('7.49  Synthetic promotion',749),self.event('Synthetic promotion',1229)]
        self.assertEqual(promotion_annotation_duplicates(es)[0],{0,1})
    def test_different_sum_or_code_never_deduplicates(self):
        from ideal_journal_rules import promotion_annotation_duplicates
        es=[self.event('5.00  Synthetic promotion',500),self.event('Synthetic promotion',499)]
        self.assertEqual(promotion_annotation_duplicates(es)[0],set())
        es[1]=self.event('Synthetic promotion',500,'OTHER');self.assertEqual(promotion_annotation_duplicates(es)[0],set())
    def test_duplicate_summaries_and_unrelated_price_text_rejected(self):
        from ideal_journal_rules import promotion_annotation_duplicates
        es=[self.event('5.00  Synthetic promotion',500),self.event('Synthetic promotion',500),self.event('Synthetic promotion',500)]
        self.assertEqual(promotion_annotation_duplicates(es)[0],set())
        self.assertEqual(promotion_annotation_duplicates([self.event('5.00  Synthetic item',999)])[0],set())



class RefundChangeTests(unittest.TestCase):
    def test_refund_summary_is_not_second_tender(self):
        from ideal_journal_rules import refund_change_duplicate_correction as f
        self.assertEqual(f(-1000,-120,0,0,-1120,-1120),-1120)
        self.assertEqual(f(-600,-72,2,0,-670,-670),-670)
    def test_mismatch_partial_change_and_positive_cash_rejected(self):
        from ideal_journal_rules import refund_change_duplicate_correction as f
        self.assertIsNone(f(-1000,-120,0,0,-1120,-500))
        self.assertIsNone(f(-1000,-120,0,0,-1100,-1100))
        self.assertIsNone(f(1000,120,0,0,1120,1120))
        self.assertIsNone(f(-1000,-120,0,100,-1120,-1120))



class BenchmarkScopeTests(unittest.TestCase):
    def test_journal_only_customer_is_separate_not_a_new_mismatch(self):
        from ideal_journal_rules import reconcile_corrections
        residual,outside=reconcile_corrections({'A':1120},{'A':-1120,'JOURNAL_ONLY':-630},{'A','B'})
        self.assertEqual(residual,{})
        self.assertEqual(outside,{'JOURNAL_ONLY':-630})
        self.assertEqual(2-len(residual),2)
    def test_baseline_outside_scope_fails_closed(self):
        from ideal_journal_rules import reconcile_corrections
        with self.assertRaises(ValueError):reconcile_corrections({'OTHER':1},{},{'A'})



class StandaloneVoidRelationshipTests(unittest.TestCase):
    def group(self,kind='product',col=12,row=81):
        return {'events':[{'kind':kind,'sheet':'S','row':row,'col':col,'precedingStandaloneVoid':{'sheet':'S','row':79,'col':10}}],'ambiguities':['standalone_void_relationship']}
    def test_direct_same_code_column_product_only(self):
        from ideal_journal_rules import resolve_standalone_void_products as f
        es,amb,n=f(self.group());self.assertEqual((es[0]['kind'],amb,n),('voided_detail',[],1))
    def test_tender_cross_column_and_wrap_stay_ambiguous(self):
        from ideal_journal_rules import resolve_standalone_void_products as f
        for g in [self.group('DEBIT/CREDIT'),self.group(col=11),self.group(row=70),self.group(row=90)]:
            es,amb,n=f(g);self.assertEqual(n,0);self.assertTrue(amb)
    def test_repeated_marker_ambiguity_not_cleared(self):
        from ideal_journal_rules import resolve_standalone_void_products as f
        g=self.group();g['ambiguities'].append('multiple_standalone_voids')
        self.assertIn('multiple_standalone_voids',f(g)[1])

class ExplicitReturnTests(unittest.TestCase):
    def test_signed_discount_and_credit_issuance_separate(self):
        from ideal_journal_rules import explicit_return_net as f
        es=[{'kind':'product','cents':-7998},{'kind':'discount','cents':1600,'description':'20% General Discount :20% Item Discount'},{'kind':'product','cents':7166,'creditIssue':True}]
        self.assertEqual(f(es),-6398)
        for extra in [{'kind':'CASH','cents':1},{'kind':'unclassified','cents':1}]:self.assertIsNone(f(es+[extra]))
        es[1]['description']='unknown discount';self.assertIsNone(f(es))
    def test_mismatched_percentage_rejected(self):
        from ideal_journal_rules import explicit_return_net as f
        self.assertIsNone(f([{'kind':'product','cents':-100},{'kind':'product','creditIssue':True,'cents':100},{'kind':'discount','description':'20% General Discount :50% Item Discount','cents':20}]))

class SignedRefundTests(unittest.TestCase):
    def test_positive_change_only_when_source_balances(self):
        from ideal_journal_rules import refund_change_duplicate_correction as f
        self.assertEqual(f(-399,-20,-1,0,-420,420),420)
        self.assertIsNone(f(-399,-20,-1,0,-420,421))
        self.assertIsNone(f(-398,-20,-1,0,-420,420))
    def test_exact_discount_label_only(self):
        from ideal_journal_rules import explicit_discount as f
        self.assertTrue(f({'kind':'discount','description':'20% General Discount :20% Item Discount'}))
        self.assertFalse(f({'kind':'discount','description':'misc discount'}))
        self.assertTrue(f({'kind':'discount','description':'10% 10% DISCOUNT :10% Item Discount'}))
        self.assertFalse(f({'kind':'discount','description':'10% 20% DISCOUNT :10% Item Discount'}))

class PromotionQuantityTests(unittest.TestCase):
    def test_quantity_three_summary_requires_exact_source_sum(self):
        from ideal_journal_rules import promotion_annotation_duplicates as f
        def e(desc,cents,qty):return {'kind':'product','description':desc,'sourceCode':'SYNTH','cents':cents,'qty':qty}
        es=[e('2.00  Synthetic sale',200,1),e('1.00  Synthetic sale',100,1),e('Synthetic sale',300,3)]
        self.assertEqual(f(es)[0],{0,1})
        es[2]['cents']=301;self.assertEqual(f(es)[0],set())
        es[2]['cents']=300;es[2]['qty']=0;self.assertEqual(f(es)[0],set())

class BoundaryFailureTests(unittest.TestCase):
    def test_pending_void_preserved_at_receipt_and_section_boundaries(self):
        from ideal_journal_rules import unresolved_void_boundary,resolve_standalone_void_products
        for boundary in ['receipt_boundary','section_end','repeated_marker']:
            group={'events':[],'ambiguities':[]};marker={'sheet':'S','row':9,'col':0}
            self.assertTrue(unresolved_void_boundary(group,marker,boundary))
            self.assertEqual(group['unresolvedMarkers'][0]['row'],9)
            self.assertIn('unresolved_void_at_'+boundary,resolve_standalone_void_products(group)[1])
            self.assertFalse(unresolved_void_boundary(group,None,boundary))
    def test_missing_change_retained_and_not_invented(self):
        from ideal_journal_rules import source_change_event
        row=['']*20;row[2]='Change';row[9]=9.99
        e=source_change_event(row,2,'S',10)
        self.assertEqual(e['kind'],'unresolved_change');self.assertNotIn('cents',e)
        row[6]=1.25;self.assertEqual(source_change_event(row,2,'S',10)['cents'],125)

if __name__=='__main__':unittest.main()
