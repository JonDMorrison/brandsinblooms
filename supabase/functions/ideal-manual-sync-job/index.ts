import { createClient } from 'npm:@supabase/supabase-js@2';
import { createManualSyncJobHandler } from './handler.ts';
Deno.serve(createManualSyncJobHandler(createClient, name => Deno.env.get(name)));
