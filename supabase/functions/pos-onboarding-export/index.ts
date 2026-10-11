import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.117.2';
import {onboardingExporter} from '../_shared/onboarding-transfer.ts';
const db=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(onboardingExporter({
 binding:async(key)=>{const r=await db.rpc('pos_onboarding_binding',{p_key:key});if(r.error)throw Error('Connection unavailable');return r.data;},
 snapshot:async(key)=>{const r=await db.rpc('pos_onboarding_snapshot',{p_key:key});if(r.error)throw Error('Snapshot unavailable');return r.data;},
}));
