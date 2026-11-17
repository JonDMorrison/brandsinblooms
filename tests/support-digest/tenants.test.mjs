import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDigestEmail,renderAlertEmail,groupAlertFindings} from '../../supabase/functions/_shared/bloom-support/support-emails.ts';
const opts={appUrl:'https://bloomsuite.app',date:'Tue, Nov17',timeZone:'UTC'};
const observed={capped:false,summary:'573 deleted or merged customers are still in customer groups across 1 companies. Group counts and campaign audiences may be wrong.',tenants:1,condition:'orphan_segment_memberships',customers:573,dedupe_window:'day'};
const report=(finding)=>({needs_you:[],resolved:[],said:[],repairs:[],alerts:[{condition:finding.condition,detail:finding}],counts:{new:0,open:0}});
test('Nov17 aggregate finding renders without suppressing the digest or losing its summary',()=>{
 const mail=renderDigestEmail(report(observed),opts);assert.ok(mail);assert.match(mail.text,/Deleted customers are still in customer groups/);
 const alert=renderAlertEmail(groupAlertFindings([observed])[0],opts);assert.match(alert.text,/573 deleted/);assert.match(alert.text,/Affected companies: 1/);
});
test('company detail arrays still retain names and measured values',()=>{
 const f={condition:'bloom_request_errors',tenants:[{tenant_name:'Example Garden',errors:4,access_denied:2}]};const a=renderAlertEmail(groupAlertFindings([f])[0],opts);assert.match(a.text,/Example Garden: 4 failed requests, 2 refused access/);assert.ok(renderDigestEmail(report(f),opts));
});
test('null absent and zero company counts do not throw or erase the finding',()=>{
 for(const tenants of [undefined,null,0,[]]){const f={...observed,tenants};assert.ok(renderDigestEmail(report(f),opts));assert.match(renderAlertEmail(groupAlertFindings([f])[0],opts).text,/573 deleted/);}
});
test('malformed scalar and mixed rows remain visible with a review warning',()=>{
 for(const tenants of ['1',{},true,-1,NaN,[null,7,'bad',{tenant_name:44},{tenant_name:'Valid Garden',errors:3}]]){const f={...observed,tenants};const a=renderAlertEmail(groupAlertFindings([f])[0],opts);assert.match(a.text,/details could not be read/);assert.match(a.text,/573 deleted/);assert.ok(renderDigestEmail(report(f),opts));}
});
test('untrusted tenant names are escaped and bad metrics are not invented',()=>{
 const f={condition:'email_reputation_low',tenants:[{tenant_name:'<script>oops</script>',score:'fake'}]};const a=renderAlertEmail(groupAlertFindings([f])[0],opts);assert.doesNotMatch(a.html,/<script>/);assert.match(a.text,/not reported/);
});
