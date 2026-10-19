import {createClient} from "npm:@supabase/supabase-js@2.58.0";
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json(405,{error:"method_not_allowed"});
 const signature=req.headers.get("x-bloom-signature")??"",timestamp=Number(req.headers.get("x-bloom-timestamp"));
 if(!/^[a-f0-9]{64}$/.test(signature)||!Number.isSafeInteger(timestamp)||Math.abs(Date.now()/1000-timestamp)>300)return json(401,{error:"invalid_envelope"});
 const reader=req.body?.getReader();if(!reader)return json(400,{error:"invalid_body"});
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();return json(413,{error:"payload_too_large"});}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.rpc("accept_website_newsletter",{p_body:new TextDecoder().decode(bytes),p_timestamp:timestamp,p_signature:signature});
 if(error)return json(error.message==="invalid_signature"?401:409,{error:"signup_not_accepted"});
 return json(200,data);
});
