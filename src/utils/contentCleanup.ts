import { supabase } from "@/integrations/supabase/client";

export async function cleanupDuplicateContent(campaignTitle: string) {
  try {
    console.log('🧹 Starting content cleanup for:', campaignTitle);
    
    const { data, error } = await supabase.functions.invoke('cleanup-duplicate-content', {
      body: { campaign_title: campaignTitle }
    });

    if (error) {
      console.error('❌ Cleanup error:', error);
      throw error;
    }

    console.log('✅ Cleanup result:', data);
    return data;
  } catch (error) {
    console.error('❌ Error cleaning up content:', error);
    throw error;
  }
}