import { deepStrictEqual as equal, ok, rejects } from "node:assert/strict";
import { runAgent, type AgentContext } from "./slack-agent-core.ts";
import { readReleaseEvidence, releaseDeliveryProof, releaseFallback } from "./slack-release-evidence.ts";
const c={principal_id:"10000000-0000-4000-8000-000000000001",role:"platform_admin",channel:"C0CFYDVE4A0",route:"releases",root_ts:"1795141661.807849",user_id:"UTESTUSER01",ticket_id:null};
const core:AgentContext={jobId:"fixture",principalId:c.principal_id,role:c.role,channel:c.channel,route:c.route,rootTs:c.root_ts,ticketId:null,question:"",history:[],privateChannel:true};
const evidence={scope:"recent_sample",records:[{product:"POS",kind:"github.pr_merged",title:"Password setup and recovery",description:"Staff can complete account setup and recover access."},{product:"POS",kind:"github.pr_merged",title:"Longer cashier PINs",description:"Cashiers can use longer PINs."}]};
for(const question of ["@Bloom can you describe how these changes will help a customer","How does the recent merges help our customers on our tech"]){
 Deno.test("release replay answers before clarification: "+question,async()=>{
  const tools:string[]=[];const audits:string[]=[];
  const result=await runAgent({...core,question},{authorize:()=>Promise.resolve(true),execute:(name)=>{tools.push(name);return Promise.resolve({data:evidence,source:"release receipts",fallback:releaseFallback(evidence)});},audit:(name,outcome)=>{audits.push(name+":"+outcome);return Promise.resolve();},model:()=>Promise.resolve({role:"assistant",content:"Which product or PR do you mean?"})});
  equal(tools,["release_status"]);equal(audits,["release_status:succeeded"]);equal(result.calls,1);
  ok(result.text.includes("Assuming"));ok(result.text.includes("Longer cashier PINs"));ok(result.text.includes("deployment not established"));ok(!result.text.startsWith("Which"));
 });
}
Deno.test("release prefetch respects denial and provider failure with no mutation tools",async()=>{
 let calls=0;
 const deps={authorize:()=>Promise.resolve(true),execute:()=>{calls++;return Promise.reject(Error("provider down"));},audit:()=>Promise.resolve(),model:()=>Promise.reject(Error("model down"))};
 const result=await runAgent({...core,question:"Describe recent merges"},deps);
 ok(result.text.includes("couldn't verify"));equal(calls,1);
 calls=0;await runAgent({...core,role:"client",question:"Describe recent merges"},deps);equal(calls,0);
 await runAgent({...core,privateChannel:false,question:"Describe recent merges"},deps);equal(calls,0);
 const revoked=await runAgent({...core,question:"Describe recent merges"},{...deps,authorize:()=>Promise.resolve(false)});equal(calls,0);equal(revoked.sources,[]);
});
Deno.test("notification proof is exact, never an inferred nearby post",()=>{
 equal(releaseDeliveryProof("github.pr_merged","delivered to releases (Slack ts: 1795141661.807849)",c.channel),{route:"releases",channel:c.channel,ts:c.root_ts});
 for(const note of ["queued","delivered to alerts (Slack ts: 1795141661.807849)","delivered to releases (Slack ts: bad)"])
  equal(releaseDeliveryProof("github.pr_merged",note,c.channel),null);
 ok(releaseFallback({...evidence,scope:"notification"}).startsWith("For the release notice"));
 ok(releaseFallback({records:[]}).includes("couldn't verify"));
 const deployment=releaseFallback({records:[{product:"POS",kind:"github.deployment_succeeded"}]});
 ok(deployment.includes("not linked to a specific PR"));ok(deployment.includes("do not establish"));
});
Deno.test("release reads are job-bound, fixed-provider GETs and fail closed on changed context",async()=>{
 const original=fetch;const vars={SUPABASE_URL:"https://release-fixture.invalid",SUPABASE_SERVICE_ROLE_KEY:"fixture",BLOOM_SUPPORT_SLACK_CHANNEL_RELEASES:c.channel,BLOOM_GITHUB_REPAIR_TOKEN:"fixture-read"};
 const before=Object.fromEntries(Object.keys(vars).map(k=>[k,Deno.env.get(k)]));Object.entries(vars).forEach(([k,v])=>Deno.env.set(k,v));
 let wrong=false;const calls:string[]=[];
 globalThis.fetch=(input,init)=>{
  const url=String(input);calls.push(url);
  if(url.includes("/rest/v1/rpc/")){
   equal(JSON.parse(String(init?.body)),{p_job:"fixture"});
   return Promise.resolve(new Response(JSON.stringify({...c,channel:wrong?"CWRONG0001":c.channel,scope:"recent_sample",records:[{url:"https://github.com/Brands-In-Blooms/bloomtill/pull/695",kind:"github.pr_merged"},{url:"https://evil.example/pull/1",kind:"github.pr_merged"}]}),{headers:{"Content-Type":"application/json"}}));
  }
  equal(url,"https://api.github.com/repos/Brands-In-Blooms/bloomtill/pulls/695");equal(init?.method,undefined);
  return Promise.resolve(new Response(JSON.stringify({html_url:"https://github.com/Brands-In-Blooms/bloomtill/pull/695",number:695,merged:true,title:"Password setup",body:"Staff can recover access. Do not infer deployment."})));
 };
 try{
  const result=await readReleaseEvidence(c,"fixture");equal(result.links.length,1);ok(result.fallback.includes("Password setup"));equal(calls.length,2);
  wrong=true;await rejects(()=>readReleaseEvidence(c,"fixture"));equal(calls.length,3);
  await rejects(()=>readReleaseEvidence({...c,route:"ask"},"fixture"));equal(calls.length,3);
 }finally{globalThis.fetch=original;Object.entries(before).forEach(([k,v])=>v===undefined?Deno.env.delete(k):Deno.env.set(k,v));}
});
