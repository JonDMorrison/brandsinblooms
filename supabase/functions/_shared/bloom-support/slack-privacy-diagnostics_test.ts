import { assertEquals, assert } from "@std/assert";
import { privacyDiagnostic } from "./slack-agent.ts";
Deno.test("privacy diagnostics contain only bounded permission and privacy metadata", () => {
 const result=privacyDiagnostic("C123",{error:"missing_scope",needed:"groups:read",provided:"chat:write,app_mentions:read",token:"never-log",channel:{id:"C123",is_private:true,is_shared:false,is_ext_shared:false,name:"private-client",members:["private-person"],topic:{value:"secret content"}}});
 assertEquals(result.error,"missing_scope"); assertEquals(result.needed,"groups:read"); assertEquals(result.is_private,true); assertEquals(result.id_matches,true);
 const output=JSON.stringify(result); for(const value of ["never-log","private-client","private-person","secret content"]) assert(!output.includes(value));
});
Deno.test("unexpected API body fields are not reflected into logs",()=>{
 const result=privacyDiagnostic("C123",{error:"Bearer secret?",needed:"https://secret.test",provided:"x".repeat(170),channel:null});
 assertEquals(result.error,undefined); assertEquals(result.needed,undefined); assertEquals(result.provided,undefined); assertEquals(result.is_private,false);
});
