import { supabase } from "@/integrations/supabase/client";

export async function cleanupDuplicateContent(campaignTitle: string) {
  try {
    const { data, error } = await supabase.functions.invoke(
      "cleanup-duplicate-content",
      {
        body: { campaign_title: campaignTitle },
      },
    );

    if (error) {
      console.error("❌ Cleanup error:", error);
      throw error;
    }
    return data;
  } catch (error) {
    console.error("❌ Error cleaning up content:", error);
    throw error;
  }
}
