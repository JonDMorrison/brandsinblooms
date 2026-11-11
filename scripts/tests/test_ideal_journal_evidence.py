import copy
import unittest
from ideal_journal_evidence import layout_evidence
from ideal_journal_gate import classify_receipt

class LayoutEvidenceTests(unittest.TestCase):
 def group(self):
  return {'receipt':{},'ambiguities':['standalone_void_relationship'], 'events':[
   {'kind':'product','sheet':'S','row':3,'col':2,'cents':1000,'precedingStandaloneVoid':{'sheet':'S','row':1,'col':0}},
   {'kind':'product','cents':500}, {'kind':'CASH','cents':500}]}
 def test_resolved_marker_keeps_raw_provenance_and_equation(self):
  g=self.group(); original=copy.deepcopy(g); out=layout_evidence(g)
  self.assertEqual(out['ambiguities'],[])
  self.assertEqual(out['rawLayoutAmbiguities'],['standalone_void_relationship'])
  self.assertEqual(out['resolvedStandaloneVoidRelationships'],1)
  self.assertEqual(g,original)
  self.assertEqual(classify_receipt(g,1,1)[0],[])
 def test_mixed_unresolved_marker_stays_blocked(self):
  g=self.group(); bad=copy.deepcopy(g['events'][0]);bad['col']=12;g['events'].append(bad)
  self.assertIn('standalone_void_relationship',layout_evidence(g)['ambiguities'])
 def test_orphan_flag_stays_blocked(self):
  g=self.group();del g['events'][0]['precedingStandaloneVoid']
  self.assertIn('standalone_void_relationship',layout_evidence(g)['ambiguities'])
 def test_other_ambiguity_and_mismatch_stay_blocked(self):
  g=self.group();g['ambiguities'].append('multiple_standalone_voids');g['events'][-1]['cents']=501
  self.assertEqual(layout_evidence(g)['ambiguities'],['multiple_standalone_voids'])
  self.assertIn('unbalanced_source_equation',classify_receipt(g,1,1)[0])

 def test_downstream_review_uses_residual_not_raw_flags(self):
  from ideal_journal_review import review
  g=self.group();reasons,m,t,r,n=classify_receipt(g,1,1)
  f={'terminal':1,'receiptNumber':'synthetic','sourceFinancialExclusions':reasons,'originalAnchorErrors':[],
     'sourceCoverage':{'unrepresentedNumericCoordinates':[],'unownedNumericCoordinates':[]},
     'pageBoundaryProvenance':'original_biff_horizontal_breaks_and_continue',
     'sourceEquation':{'merchandiseCents':m,'taxCents':t,'roundingCents':r,'netTenderCents':n},**layout_evidence(g)}
  result=review(lambda:iter([{'customerCode':'001','fields':f}]),[{'tenantId':'tenant','code':'001','id':'a68bed2a-5d32-4aeb-8fd4-e531b079fd1d'}],'tenant')
  self.assertEqual(result['counts']['sourceAndIdentityReviewCandidates'],1)
  self.assertFalse(result['committable'])
