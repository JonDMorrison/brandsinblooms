
export const fetchCampaignContent = async (supabase: any, campaignId: string | undefined, userId: string) => {
  console.log('Fetching campaign content for:', { campaignId, userId });
  
  // If campaignId is undefined or null, get the current week's campaign
  let targetCampaignId = campaignId;
  
  if (!targetCampaignId || targetCampaignId === 'undefined') {
    console.log('No campaignId provided, finding current week campaign for user:', userId);
    
    // Get current week number
    const currentWeek = getCurrentWeekNumber();
    console.log('Current week number:', currentWeek);
    
    // Find campaign for current week
    const { data: currentCampaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('user_id', userId)
      .eq('week_number', currentWeek)
      .maybeSingle();
    
    if (campaignError) {
      console.error('Error finding current week campaign:', campaignError);
      throw new Error(`Failed to find current week campaign: ${campaignError.message}`);
    }
    
    if (!currentCampaign) {
      console.log('No campaign found for current week, trying to find any active campaign');
      
      // Fallback: get the most recent campaign
      const { data: fallbackCampaign, error: fallbackError } = await supabase
        .from('campaigns')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (fallbackError || !fallbackCampaign) {
        throw new Error('No campaigns found for user');
      }
      
      targetCampaignId = fallbackCampaign.id;
      console.log('Using fallback campaign:', targetCampaignId);
    } else {
      targetCampaignId = currentCampaign.id;
      console.log('Found current week campaign:', targetCampaignId);
    }
  }

  // Now fetch content tasks for the campaign
  console.log('Fetching content tasks for campaign:', targetCampaignId);
  
  const { data: tasks, error: tasksError } = await supabase
    .from('content_tasks')
    .select(`
      *,
      campaigns!inner (
        title,
        theme,
        description,
        week_number
      )
    `)
    .eq('campaign_id', targetCampaignId)
    .in('status', ['review', 'approved', 'ready'])
    .order('created_at', { ascending: false });

  if (tasksError) {
    console.error('Error fetching content tasks:', tasksError);
    throw new Error(`Failed to fetch campaign content: ${tasksError.message}`);
  }

  if (!tasks || tasks.length === 0) {
    console.log('No content tasks found for campaign, generating new content...');
    
    // If no tasks found, we should trigger content generation
    // For now, return empty array - the caller should handle this
    return {
      tasks: [],
      campaign: null,
      shouldGenerateContent: true
    };
  }

  console.log(`Found ${tasks.length} content tasks for campaign`);
  
  return {
    tasks: tasks || [],
    campaign: tasks[0]?.campaigns || null,
    shouldGenerateContent: false
  };
};

const getCurrentWeekNumber = () => {
  const today = new Date();
  const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
  const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};
