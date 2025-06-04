
export const getCurrentWeekCampaign = (campaigns: any[]) => {
  if (campaigns.length === 0) return null;
  
  const today = new Date();
  const currentWeekNumber = getCurrentWeekNumber();
  
  // First, try to find a campaign for the current week number
  const currentWeekCampaign = campaigns.find(campaign => {
    return campaign.week_number === currentWeekNumber;
  });
  
  if (currentWeekCampaign) return currentWeekCampaign;
  
  // If no current week campaign, try to find one within the current week by date
  const currentWeekByDateCampaign = campaigns.find(campaign => {
    const campaignDate = new Date(campaign.start_date);
    const daysDiff = Math.abs((campaignDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    return daysDiff <= 7; // Within a week
  });
  
  if (currentWeekByDateCampaign) return currentWeekByDateCampaign;
  
  // If still no match, return null to trigger auto-creation
  return null;
};

// Calculate the actual week number of the year from today's date
export const getCurrentWeekNumber = () => {
  const today = new Date();
  const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
  const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

export const getNextStepGuidance = (campaigns: any[], tasks: any[], currentCampaign: any) => {
  if (campaigns.length === 0) {
    return {
      icon: "🌱",
      title: "Next Step: Create your first campaign",
      description: "Start growing your garden center's online presence",
      action: "Start Now",
      bgColor: "bg-green-50",
      borderColor: "border-green-200"
    };
  }

  const campaignTasks = currentCampaign ? getTasksForCampaign(tasks, currentCampaign.id) : [];
  
  if (campaignTasks.length === 0) {
    return {
      icon: "📝",
      title: "Next Step: Generate content for your campaign",
      description: "Create posts and content for your active campaign",
      action: "Generate Content",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200"
    };
  }

  const draftCampaigns = campaigns.filter(c => c.status === 'draft');
  if (draftCampaigns.length > 0) {
    return {
      icon: "📝",
      title: "Next Step: Finish your draft campaign",
      description: "Complete your campaign setup to start creating content",
      action: "Continue Draft",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200"
    };
  }

  const scheduledCampaigns = campaigns.filter(c => c.status === 'scheduled');
  if (scheduledCampaigns.length > 0) {
    return {
      icon: "👀",
      title: "Next Step: Preview what's going out",
      description: "Review your scheduled content before it goes live",
      action: "Preview Content",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200"
    };
  }

  return {
    icon: "🌻",
    title: "Next Step: Create your next campaign",
    description: "Keep the momentum going with fresh content",
    action: "Start Campaign",
    bgColor: "bg-green-50",
    borderColor: "border-green-200"
  };
};

export const getSetupProgress = (onboardingData: any, campaigns: any[], tasks: any[]) => {
  const totalSteps = 5;
  const completedSteps = [
    onboardingData?.aboutBusiness, // Has business info
    true, // Assumed connected social
    campaigns.length > 0, // Has campaigns
    tasks.some(t => t.ai_output), // Has generated content
    tasks.some(t => t.status === 'posted') // Has posted content
  ].filter(Boolean).length;

  return {
    percentage: Math.round((completedSteps / totalSteps) * 100),
    completed: completedSteps,
    total: totalSteps,
    steps: [
      { label: "Added business info", completed: !!onboardingData?.aboutBusiness },
      { label: "Connected social accounts", completed: true },
      { label: "Created first campaign", completed: campaigns.length > 0 },
      { label: "Generated content", completed: tasks.some(t => t.ai_output) },
      { label: "Published content", completed: tasks.some(t => t.status === 'posted') }
    ]
  };
};

export const getUpcomingContent = (tasks: any[]) => {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
  
  return tasks
    .filter(task => {
      if (!task.scheduled_date) return false;
      const scheduledDate = new Date(task.scheduled_date);
      return scheduledDate >= today && scheduledDate <= nextMonth;
    })
    .slice(0, 3)
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
};

export const getTasksForCampaign = (tasks: any[], campaignId: string) => {
  return tasks.filter(task => task.campaign_id === campaignId);
};

export const getTasksByStatus = (tasks: any[], status: string) => {
  return tasks.filter(task => task.status === status).slice(0, 2);
};

export const getOverdueTasks = (tasks: any[]) => {
  const today = new Date();
  return tasks.filter(task => {
    if (!task.scheduled_date) return false;
    const scheduledDate = new Date(task.scheduled_date);
    return scheduledDate < today && task.status !== 'posted' && task.status !== 'skipped';
  });
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'planned': return 'bg-gray-100 text-gray-800';
    case 'generating': return 'bg-blue-100 text-blue-800';
    case 'review': return 'bg-yellow-100 text-yellow-800';
    case 'scheduled': return 'bg-green-100 text-green-800';
    case 'posted': return 'bg-emerald-100 text-emerald-800';
    case 'skipped': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};
