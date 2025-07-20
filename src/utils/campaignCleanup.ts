import { supabase } from "@/integrations/supabase/client";

export const cleanupDuplicateCampaigns = async (userId: string, weekNumber: number) => {
  console.log(`🧹 Cleaning up duplicate campaigns for user ${userId}, week ${weekNumber}`);
  
  try {
    // Get all campaigns for this user and week
    const { data: campaigns, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', userId)
      .eq('week_number', weekNumber)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching campaigns:', fetchError);
      return { success: false, message: fetchError.message };
    }

    if (!campaigns || campaigns.length <= 1) {
      console.log('No duplicates found');
      return { success: true, message: 'No cleanup needed' };
    }

    // Group campaigns by title to handle cross-title duplicates
    const campaignsByTitle: { [key: string]: any[] } = {};
    campaigns.forEach(campaign => {
      const title = campaign.title || 'Untitled';
      if (!campaignsByTitle[title]) {
        campaignsByTitle[title] = [];
      }
      campaignsByTitle[title].push(campaign);
    });

    let totalCleaned = 0;
    let bestCampaign = null;

    // Process each title group
    for (const [title, titleCampaigns] of Object.entries(campaignsByTitle)) {
      if (titleCampaigns.length <= 1) continue;

      console.log(`🔍 Processing ${titleCampaigns.length} campaigns with title: "${title}"`);

      // Identify the best campaign to keep for this title
      const bestForTitle = titleCampaigns.find(c => 
        c.theme && 
        c.theme !== `Week ${weekNumber} Seasonal Content` &&
        c.theme !== `Seasonal Gardening Focus - Week ${weekNumber}` &&
        !c.theme.includes('PREVIEW') &&
        c.source !== 'onboarding_immediate'
      ) || titleCampaigns[0]; // Fallback to newest if no good theme found

      if (!bestCampaign) bestCampaign = bestForTitle;

      console.log('🎯 Keeping campaign for title:', bestForTitle.title, 'with theme:', bestForTitle.theme);

      // Get campaigns to delete for this title
      const campaignsToDelete = titleCampaigns.filter(c => c.id !== bestForTitle.id);
      
      if (campaignsToDelete.length === 0) continue;

      console.log(`🗑️ Deleting ${campaignsToDelete.length} duplicate campaigns for title: "${title}"`);

      // Update content tasks to point to the kept campaign before deletion
      for (const campaign of campaignsToDelete) {
        const { error: updateError } = await supabase
          .from('content_tasks')
          .update({ campaign_id: bestForTitle.id })
          .eq('campaign_id', campaign.id);

        if (updateError) {
          console.error('Error updating tasks for campaign:', campaign.id, updateError);
        }
      }

      // Delete the duplicate campaigns
      const { error: deleteError } = await supabase
        .from('campaigns')
        .delete()
        .in('id', campaignsToDelete.map(c => c.id));

      if (deleteError) {
        console.error('Error deleting campaigns:', deleteError);
        return { success: false, message: deleteError.message };
      }

      totalCleaned += campaignsToDelete.length;
    }

    // Now clean up duplicate content tasks across the remaining campaigns
    if (bestCampaign) {
      try {
        console.log('🧹 Running comprehensive content cleanup...');
        const { data: cleanupResult } = await supabase.functions.invoke('cleanup-duplicate-content', {
          body: { campaign_title: bestCampaign.title }
        });

        if (cleanupResult && !cleanupResult.success) {
          console.warn('Content cleanup had issues:', cleanupResult.error);
        } else {
          console.log('✅ Content cleanup completed:', cleanupResult?.message);
        }
      } catch (cleanupError) {
        console.warn('Content cleanup failed:', cleanupError);
        // Don't fail the whole operation if content cleanup fails
      }
    }

    console.log(`✅ Successfully cleaned up ${totalCleaned} duplicate campaigns`);
    return { 
      success: true, 
      message: `Cleaned up ${totalCleaned} duplicates, kept: ${bestCampaign?.theme || 'best campaign'}`,
      bestCampaign 
    };

  } catch (error) {
    console.error('Error in cleanup:', error);
    return { success: false, message: error.message };
  }
};

export const generateMeaningfulTheme = async (weekNumber: number, companyName?: string) => {
  console.log(`🎨 Generating meaningful theme for week ${weekNumber}`);
  
  // Simple seasonal theme generation based on week number
  const month = Math.ceil(weekNumber / 4.33); // Approximate month
  const company = companyName || 'Your Garden Center';
  
  const seasonalThemes = {
    1: "New Year Garden Planning", // January
    2: "Indoor Plant Care & Houseplant Health", // February  
    3: "Spring Preparation & Soil Health", // March
    4: "Early Spring Planting & Seed Starting", // April
    5: "Spring Flowers & Garden Design", // May
    6: "Summer Garden Preparation", // June
    7: "Summer Blooms & Heat-Tolerant Plants", // July
    8: "Summer Garden Maintenance", // August
    9: "Fall Garden Transition", // September
    10: "Autumn Colors & Fall Planting", // October
    11: "Winter Preparation & Plant Protection", // November
    12: "Holiday Plants & Winter Care" // December
  };
  
  const theme = seasonalThemes[month] || `Week ${weekNumber} Garden Focus`;
  console.log(`🌱 Generated theme: ${theme}`);
  
  return {
    title: `${company} - ${theme}`,
    theme: theme,
    description: `Weekly gardening focus on ${theme.toLowerCase()} for ${company} customers`
  };
};
