import copy
import unittest
from ideal_journal_review import review


class JournalReviewTests(unittest.TestCase):
    def setUp(self):
        self.master = [{'tenantId': 'tenant', 'code': '001', 'id': 'a68bed2a-5d32-4aeb-8fd4-e531b079fd1d'}]
        self.row = {'customerCode': '001', 'fields': {
            'terminal': 1, 'receiptNumber': '0002', 'localExcelDate': 46000,
            'sourceFinancialExclusions': [], 'originalAnchorErrors': [], 'ambiguities': [],
            'sourceCoverage': {'unrepresentedNumericCoordinates': [], 'unownedNumericCoordinates': []},
            'pageBoundaryProvenance': 'original_biff_horizontal_breaks_and_continue',
            'sourceEquation': {'merchandiseCents': 100, 'taxCents': 5, 'roundingCents': 0, 'netTenderCents': 105}}}

    def run_review(self, rows=None, masters=None):
        return review(lambda: iter(rows or [self.row]), self.master if masters is None else masters, 'tenant')

    def test_review_is_never_import_authorization(self):
        result = self.run_review()
        self.assertFalse(result['committable'])
        self.assertEqual(result['counts']['sourceAndIdentityReviewCandidates'], 1)
        self.assertIn('coverage_certification', result['requiredBeforeImport'])

    def test_leading_zeros_and_cross_tenant_snapshot(self):
        self.row['customerCode'] = '1'
        self.assertEqual(self.run_review()['exclusions']['exact_customer_master_link_required'], 1)
        self.master[0]['tenantId'] = 'other'
        with self.assertRaises(ValueError): self.run_review()

    def test_conflicting_timestamp_does_not_evade_duplicate_detection(self):
        other = copy.deepcopy(self.row)
        other['fields']['localExcelDate'] += 1
        self.assertEqual(self.run_review([self.row, other])['exclusions']['duplicate_receipt_identity'], 2)

    def test_equation_and_missing_coverage_fail_closed(self):
        self.row['fields']['sourceEquation']['netTenderCents'] = 106
        del self.row['fields']['sourceCoverage']
        self.assertEqual(set(self.run_review()['exclusions']), {'incomplete_numeric_coverage', 'unbalanced_source_equation'})

    def test_negative_candidates_stay_separate_from_positive(self):
        other = copy.deepcopy(self.row)
        other['fields']['receiptNumber'] = '3'
        other['fields']['sourceEquation'] = {'merchandiseCents': -100, 'taxCents': -5, 'roundingCents': 0, 'netTenderCents': -105}
        result = self.run_review([self.row, other])
        self.assertEqual(result['reviewCandidateAmounts'], {'positiveMerchandiseCents': 100, 'negativeMerchandiseCents': -100})

    def test_ambiguous_master_and_source_exclusions_survive(self):
        self.row['fields']['sourceFinancialExclusions'] = ['issuance_semantics']
        result = self.run_review(masters=self.master * 2)
        self.assertEqual(set(result['exclusions']), {'issuance_semantics', 'exact_customer_master_link_required'})
