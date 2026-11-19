import { assertEquals, assertStringIncludes } from "@std/assert";
import { conversationFallback, internalSupportQueueAnswer, safeConversationAnswer, respondToSlackConversation } from "./slack-conversation.ts";
import { slackQuestionRoute } from "./slack-questions.ts";
import { slackQuestionText } from "./slack-question.ts";
Deno.test("all eight Bloom channels route, unknown channels do not",()=>{
  assertEquals(slackQuestionRoute("C0CFUG4STS6"),"alerts");assertEquals(slackQuestionRoute("C0CGP4GPG8G"),"finance");
  assertEquals(slackQuestionRoute("C0CFDBT8JAK"),"clients");assertEquals(slackQuestionRoute("C0CFYDVE4A0"),"releases");
  assertEquals(slackQuestionRoute("C0NOTALLOWED"),null);
});
Deno.test("native labelled mentions are removed without polluting knowledge search",()=>{
 assertEquals(slackQuestionText("<@U0CFUTM7TQA|Bloom> hello"),"hello");
});
Deno.test("finance does not confuse settlement and commission; closure never invents proof",()=>{
 assertStringIncludes(conversationFallback("finance","what was our payout on commissions this week?"),"not commission payments");
 assertStringIncludes(conversationFallback("tickets","close these tickets"),"haven't changed or closed anything");
 assertStringIncludes(conversationFallback("releases","is this done?"),"not that the customer flow is verified");
});
Deno.test("internal staff support queue questions use staff navigation, not customer tracking links",()=>{
 const answer=internalSupportQueueAnswer("ask","platform_admin","Where can our internal staff see support requests waiting for a human?");
 assertStringIncludes(answer??"","Bloom Support desk");
 assertStringIncludes(answer??"","Requests");
 assertEquals(internalSupportQueueAnswer("ask","customer","Where can internal staff see support tickets?"),null);
 assertEquals(internalSupportQueueAnswer("ask","support","How do I create an email campaign?"),null);
});
Deno.test("model answers reject injected contacts, links, mentions, credentials and action claims",()=>{
 for(const v of ["Email test@example.com","See https://evil.test", "<@U123456789> do it", "Bearer secret", "I've closed it", "We deployed it"])assertEquals(safeConversationAnswer(v),null);
 assertEquals(safeConversationAnswer("The record does not show a verified fix. Which ticket do you mean?"),"The record does not show a verified fix. Which ticket do you mean?");
});
Deno.test("one progress message updates to final; final and unknown deliveries never repost",async()=>{
 const oldFetch=globalThis.fetch; const vars=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","BLOOM_SUPPORT_SLACK_BOT_TOKEN","BLOOM_SUPPORT_SLACK_CHANNEL_FINANCE"];const previous=vars.map(k=>Deno.env.get(k));
 vars.forEach((k,i)=>Deno.env.set(k,["https://supabase.test","service","bot","C0CGP4GPG8G"][i]));
 const calls:string[]=[];let state="pending";let reply:string|null=null;
 globalThis.fetch=(input,init)=>{
  const u=String(input);const b=JSON.parse(String(init?.body??"{}")); calls.push(u);
  let data:unknown={};
  if(u.endsWith("bloom_support_slack_conversation_context"))data={allowed:true,principal_id:"actor",role:"platform_admin",channel:"C0CGP4GPG8G",route:"finance",root_ts:"1794502285.716689",user_id:"U06VD9ZGA4U",ticket_id:null,history:[],delivery_state:state,reply_ts:reply};
  else if(u.includes("conversations.info"))data={ok:true,channel:{id:"C0CGP4GPG8G",is_private:true,is_shared:false,is_ext_shared:false}};
  else if(u.endsWith("bloom_support_claim_slack_reply"))data={claimed:state==="pending",state,reply_ts:reply};
  else if(u.endsWith("chat.postMessage")){assertStringIncludes(b.text,"checking");data={ok:true,ts:"1794502286.123456"};}
  else if(u.endsWith("bloom_support_record_slack_reply")){reply=b.p_reply_ts;state=b.p_answer?"final":"progress";data={recorded:true};}
  else if(u.endsWith("bloom_support_rpc"))data={provider:"none"};
  else if(u.endsWith("chat.update")){assertEquals(b.ts,reply);assertStringIncludes(b.text,"not commission payments");data={ok:true};}
  else throw Error("unexpected "+u);
  return Promise.resolve(new Response(JSON.stringify(data),{headers:{"content-type":"application/json"}}));
 };
 try{
  const job={id:"00000000-0000-4000-8000-000000000001",payload:{question:"commissions this week"}};
  await respondToSlackConversation(job);await respondToSlackConversation(job);
  assertEquals(calls.filter(x=>x.endsWith("chat.postMessage")).length,1);assertEquals(calls.filter(x=>x.endsWith("chat.update")).length,1);
  state="unknown";reply=null;let failed=false;try{await respondToSlackConversation(job);}catch{failed=true;}assertEquals(failed,true);
  assertEquals(calls.filter(x=>x.endsWith("chat.postMessage")).length,1);
  Deno.env.set("BLOOM_SUPPORT_SLACK_CHANNEL_FINANCE","C0CFUG4LFLJ");
  state="pending";failed=false;try{await respondToSlackConversation(job);}catch{failed=true;}assertEquals(failed,true);
  assertEquals(calls.filter(x=>x.endsWith("chat.postMessage")).length,1);
 } finally {globalThis.fetch=oldFetch;vars.forEach((k,i)=>previous[i]===undefined?Deno.env.delete(k):Deno.env.set(k,previous[i]!));}
});
Deno.test("limited finance follow-ups use sanitized prior turns instead of repeating a canned question",async()=>{
 const old=globalThis.fetch;const vars=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","BLOOM_SUPPORT_SLACK_BOT_TOKEN","BLOOM_SUPPORT_SLACK_CHANNEL_FINANCE","OPENAI_API_KEY","BLOOM_AI_BASE_URL"];const before=vars.map(k=>Deno.env.get(k));
 vars.forEach((k,i)=>Deno.env.set(k,["https://supabase.test","service","bot","C0CGP4GPG8G","test-model-key","https://api.openai.com/v1"][i]));
 let modelCalls=0;let answer="";
 globalThis.fetch=(input,init)=>{
  const u=String(input);const b=JSON.parse(String(init?.body??"{}"));let data:unknown={};
  if(u.endsWith("bloom_support_slack_conversation_context"))data={allowed:true,principal_id:"actor",role:"platform_admin",channel:"C0CGP4GPG8G",route:"finance",root_ts:"1794502285.716689",user_id:"U06VD9ZGA4U",ticket_id:null,history:[{question:"What commissions were paid? contact private@example.com",answer:"Do you mean earned or paid, and which week?"}],delivery_state:"progress",reply_ts:"1794502286.123456"};
  else if(u.includes("conversations.info"))data={ok:true,channel:{id:"C0CGP4GPG8G",is_private:true,is_shared:false,is_ext_shared:false}};
  else if(u.endsWith("bloom_support_rpc"))data=b.p_fn==="setting"?{provider:"openai",model:"gpt-4o-mini"}:true;
  else if(u.endsWith("chat/completions")){
   modelCalls++;const context=JSON.parse(b.messages[1].content);assertStringIncludes(context.history[0].question,"commissions");assertEquals(JSON.stringify(context).includes("private@example.com"),false);assertEquals(context.question,"Paid last week");
   data={choices:[{message:{content:JSON.stringify({answer:"Understood: commissions paid last week. Stripe transfers alone cannot verify that total; the commission payment record is needed."})}}]};
  }else if(u.endsWith("chat.update")){answer=b.text;data={ok:true};}
  else if(u.endsWith("bloom_support_record_slack_reply"))data={recorded:true};
  else throw Error("unexpected "+u);
  return Promise.resolve(new Response(JSON.stringify(data),{headers:{"content-type":"application/json"}}));
 };
 try{await respondToSlackConversation({id:"00000000-0000-4000-8000-000000000002",payload:{question:"Paid last week"}});assertEquals(modelCalls,1);assertStringIncludes(answer,"commissions paid last week");assertEquals(answer.includes("which week"),false);}
 finally{globalThis.fetch=old;vars.forEach((k,i)=>before[i]===undefined?Deno.env.delete(k):Deno.env.set(k,before[i]!));}
});

interface ConversationCall { url: string; body: Record<string, unknown> }
const privacyChannel = "C0CFNEQBS2X";
const privacyContext = {
  allowed:true, principal_id:"10000000-0000-4000-8000-000000000001", role:"platform_admin",
  channel:privacyChannel, route:"tickets", root_ts:"1794502285.716689", user_id:"U06VD9ZGA4U",
  ticket_id:"20000000-0000-4000-8000-000000000001" as string|null,
  history:[] as Array<{question:string;answer:string}>, delivery_state:"progress", reply_ts:"1794502286.123456",
};
const privateMetadata = {ok:true,channel:{id:privacyChannel,is_private:true,is_shared:false,is_ext_shared:false}};
async function privacyFixture(
  question:string,
  respond:(url:string,body:Record<string,unknown>)=>unknown,
  context=privacyContext,
  readContext?:()=>typeof privacyContext,
):Promise<{calls:ConversationCall[];answer:string}> {
  const vars:Record<string,string>={SUPABASE_URL:"https://supabase.test",SUPABASE_SERVICE_ROLE_KEY:"test-service",
    BLOOM_SUPPORT_SLACK_BOT_TOKEN:"test-bot",BLOOM_SUPPORT_SLACK_CHANNEL_TICKETS:privacyChannel,
    BLOOM_SUPPORT_SLACK_CHANNEL_ASK:privacyChannel,OPENAI_API_KEY:"test-model",BLOOM_AI_BASE_URL:"https://api.openai.com/v1"};
  const prior=Object.fromEntries(Object.keys(vars).map(k=>[k,Deno.env.get(k)]));
  const oldFetch=globalThis.fetch;const calls:ConversationCall[]=[];let answer="";
  for(const [k,v] of Object.entries(vars))Deno.env.set(k,v);
  globalThis.fetch=(input,init)=>{
    const url=String(input),body=JSON.parse(String(init?.body??"{}"));calls.push({url,body});
    let data:unknown;
    if(url.endsWith("bloom_support_slack_conversation_context"))data=readContext?readContext():context;
    else if(url.endsWith("chat.update")){answer=body.text;data={ok:true};}
    else if(url.endsWith("bloom_support_record_slack_reply"))data={recorded:true};
    else data=respond(url,body);
    return Promise.resolve(new Response(JSON.stringify(data),{headers:{"content-type":"application/json"}}));
  };
  try{await respondToSlackConversation({id:"30000000-0000-4000-8000-000000000001",payload:{question}});return {calls,answer};}
  finally{globalThis.fetch=oldFetch;for(const [k,v] of Object.entries(prior))v===undefined?Deno.env.delete(k):Deno.env.set(k,v);}
}
const PUBLIC_REFUSAL="This channel is public, so I can't share ticket or client records here. Ask in a private Bloom channel or use the Bloom Support desk.";
const SHARED_REFUSAL="This channel is shared outside Brands in Blooms, so I can't share ticket or client records here. Use the Bloom Support desk.";
const LOOKUP_REFUSAL="I couldn't check this channel with Slack. The Bloom Slack app may be missing a permission (channels:read, groups:read). No records were shared.";
Deno.test("ticket reads and action shortcuts are refused with the matching reason in public, shared and unverified channels",async()=>{
  const cases:Array<[unknown,boolean,string]>=[
    [{ok:false,error:"missing_scope"},false,LOOKUP_REFUSAL],
    [{ok:false,error:"missing_scope"},true,LOOKUP_REFUSAL],
    [{ok:true,channel:{id:privacyChannel,is_private:false}},false,PUBLIC_REFUSAL],
    [{ok:true,channel:{id:privacyChannel,is_private:true,is_shared:true}},false,SHARED_REFUSAL],
    [{ok:true,channel:{id:privacyChannel,is_private:true,is_shared:true}},true,SHARED_REFUSAL],
    [{ok:true,channel:{id:privacyChannel,is_private:false,is_ext_shared:true}},true,SHARED_REFUSAL],
  ];
  for(const [metadata,allowAny,expected] of cases)for(const question of ["What is happening with this ticket?","Claim this"]){
    const result=await privacyFixture(question,(url,body)=>{
      if(url.includes("conversations.info"))return metadata;
      if(url.endsWith("bloom_support_rpc")&&body.p_fn==="setting")return {enabled:true,allow_any_staff_channel:allowAny};
      throw Error("Private data or action attempted: "+url);
    });
    assertEquals(result.answer,expected,JSON.stringify({metadata,allowAny,question}));
    assertEquals(result.calls.some(c=>c.url.endsWith("bloom_support_rpc")&&c.body.p_fn!=="setting"),false);
    assertEquals(result.calls.some(c=>c.url.endsWith("chat/completions")),false);
  }
});
Deno.test("a public internal channel answers ticket questions with history when allow_any_staff_channel is on",async()=>{
  const result=await privacyFixture("What is the problem?",(url,body)=>{
    if(url.includes("conversations.info"))return {ok:true,channel:{id:privacyChannel,is_private:false,is_shared:false,is_ext_shared:false}};
    if(url.endsWith("bloom_support_rpc")){
      if(body.p_fn==="setting")return (body.p as Record<string,unknown>).key==="slack_agent"?{enabled:false,allow_any_staff_channel:true}:{provider:"openai",model:"gpt-4o-mini"};
      if(body.p_fn==="get_ticket")return {id:privacyContext.ticket_id,number:42,subject:"TicketFactSentinel",status:"working",messages:[]};
      if(body.p_fn==="consume_usage")return true;
      if(body.p_fn==="log_usage")return null;
    }
    if(url.endsWith("chat/completions")){
      const input=JSON.stringify(body.messages);
      assertStringIncludes(input,"TicketFactSentinel");
      assertStringIncludes(input,"EarlierTurnSentinel");
      return {choices:[{message:{content:JSON.stringify({answer:"Request 42 is still being worked on."})}}]};
    }
    throw Error("Unexpected "+url);
  },{...privacyContext,history:[{question:"EarlierTurnSentinel",answer:"Earlier answer"}]});
  assertEquals(result.calls.filter(c=>c.body.p_fn==="get_ticket").length,1);
  assertEquals(result.calls.filter(c=>c.url.includes("conversations.info")).length,2);
  assertStringIncludes(result.answer,"Request 42 is still being worked on.");
});
Deno.test("a private channel needs no setting and keeps working with allow_any_staff_channel off",async()=>{
  const result=await privacyFixture("Claim this",(url,body)=>{
    if(url.includes("conversations.info"))return privateMetadata;
    if(url.endsWith("bloom_support_rpc")&&["claim_ticket","set_automation"].includes(String(body.p_fn)))return {};
    if(url.endsWith("bloom_support_rpc")&&body.p_fn==="setting")return {enabled:true,allow_any_staff_channel:false};
    throw Error("Unexpected "+url);
  });
  assertEquals(result.calls.filter(c=>c.body.p_fn==="claim_ticket").length,1);
  assertEquals(result.calls.some(c=>c.body.p_fn==="setting"),false);
  assertStringIncludes(result.answer,"this ticket is now yours");
});
Deno.test("legacy fallback rechecks live privacy after reading a ticket and suppresses disclosure",async()=>{
  let privacyChecks=0;
  const result=await privacyFixture("What is the problem?",(url,body)=>{
    if(url.includes("conversations.info"))return ++privacyChecks===1?privateMetadata:{ok:true,channel:{id:privacyChannel,is_private:false}};
    if(url.endsWith("bloom_support_rpc")){
      if(body.p_fn==="setting")return {enabled:false,provider:"none"};
      if(body.p_fn==="get_ticket")return {id:privacyContext.ticket_id,number:42,subject:"CONFIDENTIAL_TICKET_SENTINEL",status:"working",messages:[]};
    }
    throw Error("Unexpected "+url);
  });
  assertEquals(result.calls.filter(c=>c.body.p_fn==="get_ticket").length,1);
  assertStringIncludes(result.answer,"can no longer verify");
  assertEquals(result.answer.includes("CONFIDENTIAL_TICKET_SENTINEL"),false);
});
Deno.test("authorized private shortcuts still execute once and verify privacy before delivery",async()=>{
  const result=await privacyFixture("Claim this",(url,body)=>{
    if(url.includes("conversations.info"))return privateMetadata;
    if(url.endsWith("bloom_support_rpc")&&["claim_ticket","set_automation"].includes(String(body.p_fn)))return {};
    throw Error("Unexpected "+url);
  });
  assertEquals(result.calls.filter(c=>c.body.p_fn==="claim_ticket").length,1);
  assertEquals(result.calls.filter(c=>c.body.p_fn==="set_automation").length,1);
  assertEquals(result.calls.filter(c=>c.url.includes("conversations.info")).length,2);
  assertStringIncludes(result.answer,"this ticket is now yours");
});
Deno.test("revoking a Slack mapping during the privacy lookup prevents legacy mutations",async()=>{
  let contextReads=0;
  const result=await privacyFixture("Claim this",(url)=>{
    if(url.includes("conversations.info"))return privateMetadata;
    throw Error("Unexpected action: "+url);
  },privacyContext,()=>({...privacyContext,allowed:++contextReads===1}));
  assertStringIncludes(result.answer,"can no longer verify");
  assertEquals(result.calls.some(c=>["claim_ticket","set_automation"].includes(String(c.body.p_fn))),false);
});
Deno.test("public legacy knowledge lookup and model never receive earlier private history",async()=>{
  const result=await privacyFixture("How do I reopen a pre-sale?",(url,body)=>{
    if(url.includes("conversations.info"))return {ok:true,channel:{id:privacyChannel,is_private:false}};
    if(url.endsWith("bloom_support_rpc")){
      if(body.p_fn==="setting")return (body.p as Record<string,unknown>).key==="slack_agent"?{enabled:false}:{provider:"openai",model:"gpt-4o-mini"};
      if(body.p_fn==="search_knowledge")return [{title:"Reopen sales",body:"Choose Reopen sales after setting valid future dates."}];
      if(body.p_fn==="consume_usage")return true;
      if(body.p_fn==="log_usage")return null;
    }
    if(url.endsWith("chat/completions"))return {choices:[{message:{content:JSON.stringify({answer:"Choose Reopen sales after setting valid future dates."})}}]};
    throw Error("Unexpected "+url);
  },{...privacyContext,route:"ask",ticket_id:null,history:[{question:"CONFIDENTIAL_QUESTION_SENTINEL",answer:"CONFIDENTIAL_ANSWER_SENTINEL"}]});
  assertStringIncludes(result.answer,"Choose Reopen sales");
  const privateInputs=JSON.stringify(result.calls.filter(c=>c.body.p_fn==="search_knowledge"||c.url.endsWith("chat/completions")));
  assertEquals(privateInputs.includes("CONFIDENTIAL_"),false);
});
Deno.test("a provider rejected by the agent cannot receive ticket facts through legacy fallback",async()=>{
  const result=await privacyFixture("What is the problem?",(url,body)=>{
    if(url.includes("conversations.info")){
      Deno.env.set("BLOOM_AI_BASE_URL","https://untrusted.example/v1");
      return privateMetadata;
    }
    if(url.endsWith("bloom_support_rpc")){
      if(body.p_fn==="setting")return (body.p as Record<string,unknown>).key==="slack_agent"?{enabled:true}:{provider:"openai",model:"gpt-4o-mini"};
      if(body.p_fn==="get_ticket")return {id:privacyContext.ticket_id,number:42,subject:"Recorded ticket evidence",status:"working",messages:[]};
    }
    throw Error("Unexpected provider request: "+url);
  });
  assertEquals(result.calls.filter(c=>c.body.p_fn==="get_ticket").length,1);
  assertEquals(result.calls.some(c=>c.url.includes("untrusted.example")||c.url.endsWith("chat/completions")),false);
  assertEquals(result.answer.includes("couldn't finish checking"),false);
});
