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

    // Identify the best campaign to keep
    const bestCampaign = campaigns.find(c => 
      c.theme && 
      c.theme !== `Week ${weekNumber} Seasonal Content` &&
      c.theme !== `Seasonal Gardening Focus - Week ${weekNumber}` &&
      !c.theme.includes('PREVIEW') &&
      c.source !== 'onboarding_immediate'
    ) || campaigns[0]; // Fallback to newest if no good theme found

    console.log('🎯 Keeping campaign:', bestCampaign.title, 'with theme:', bestCampaign.theme);

    // Get campaigns to delete (all except the best one)
    const campaignsToDelete = campaigns.filter(c => c.id !== bestCampaign.id);
    
    if (campaignsToDelete.length === 0) {
      return { success: true, message: 'No duplicates to remove' };
    }

    console.log(`🗑️ Deleting ${campaignsToDelete.length} duplicate campaigns`);

    // Delete content tasks for campaigns we're removing
    for (const campaign of campaignsToDelete) {
      const { error: tasksError } = await supabase
        .from('content_tasks')
        .delete()
        .eq('campaign_id', campaign.id);

      if (tasksError) {
        console.error('Error deleting tasks for campaign:', campaign.id, tasksError);
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

    console.log(`✅ Successfully cleaned up ${campaignsToDelete.length} duplicate campaigns`);
    return { 
      success: true, 
      message: `Cleaned up ${campaignsToDelete.length} duplicates, kept: ${bestCampaign.theme}`,
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
