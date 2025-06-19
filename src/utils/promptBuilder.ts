
// This file has been consolidated into the edge function prompt builder
// All prompt building now happens in supabase/functions/generate-content/prompt-builder.ts
// This ensures consistency and eliminates conflicting prompt systems

export function buildContentPrompt() {
  throw new Error('Prompt building has been moved to edge functions. Use supabase functions instead.');
}
