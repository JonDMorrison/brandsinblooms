import { env } from "./runtime.ts";
/** Wake the existing authenticated worker; cron remains the durable fallback. */
export async function wakeSlackWorker():Promise<void>{
  const base=env("SUPABASE_URL"); const key=env("SUPABASE_SERVICE_ROLE_KEY");
  if(!base||!key)return;
  await fetch(base+"/functions/v1/bloom-support-worker",{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(55000)}).then(r=>r.body?.cancel()).catch(()=>undefined);
}
