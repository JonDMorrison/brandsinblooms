import { assertEquals, assertStringIncludes } from "@std/assert";
import { conversationFallback, safeConversationAnswer, respondToSlackConversation } from "./slack-conversation.ts";
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
 vars.forEach((k,i)=>Deno.env.set(k,["https://supabase.test","service","bot","C0CGP4GPG8G","test-model-key","https://model.test/v1"][i]));
 let modelCalls=0;let answer="";
 globalThis.fetch=(input,init)=>{
  const u=String(input);const b=JSON.parse(String(init?.body??"{}"));let data:unknown={};
  if(u.endsWith("bloom_support_slack_conversation_context"))data={allowed:true,principal_id:"actor",role:"platform_admin",channel:"C0CGP4GPG8G",route:"finance",root_ts:"1794502285.716689",user_id:"U06VD9ZGA4U",ticket_id:null,history:[{question:"What commissions were paid? contact private@example.com",answer:"Do you mean earned or paid, and which week?"}],delivery_state:"progress",reply_ts:"1794502286.123456"};
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
