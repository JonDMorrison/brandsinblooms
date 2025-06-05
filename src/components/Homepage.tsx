import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TaskChecklist } from "@/components/TaskChecklist";
import { WelcomeSection } from "./homepage/WelcomeSection";
import { WeekCampaignCard } from "./homepage/WeekCampaignCard";
import { SetupProgressCard } from "./homepage/SetupProgressCard";
import { CampaignTasksCard } from "./homepage/CampaignTasksCard";
import { UpcomingContentCard } from "./homepage/UpcomingContentCard";
import { QuickActionsGrid } from "./homepage/QuickActionsGrid";
import { ContentPipelineCard } from "./homepage/ContentPipelineCard";
import { AnalyticsSnapshot } from "./homepage/AnalyticsSnapshot";
import { getSeasonalContent } from "./homepage/SeasonalContent";
import { 
  getCurrentWeekCampaign,
  getSetupProgress,
  getUpcomingContent,
  getTasksForCampaign,
  getOverdueTasks,
  getCurrentWeekNumber
} from "./homepage/homepageUtils";

interface HomepageProps {
  onboardingData: any;
  onNavigateToKanban: () => void;
  onTaskClick: (task: any) => void;
  campaigns: any[];
  tasks: any[];
  onTaskUpdate?: () => void;
}

export const Homepage = ({ onboardingData, onNavigateToKanban, onTaskClick, campaigns, tasks, onTaskUpdate }: HomepageProps) => {
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);

  // Generate AI content for newsletter and video script
  const generateNewsletterContent = async (campaignId: string, campaignTitle: string, weekNumber: number) => {
    try {
      console.log('Generating newsletter for campaign:', campaignTitle);
      
      const { data, error } = await supabase.functions.invoke('generate-newsletter', {
        body: {
          campaignId,
          campaignTitle,
          weekNumber
        }
      });

      if (error) {
        console.error('Error generating newsletter:', error);
        return generateFallbackNewsletter(campaignTitle, weekNumber);
      }

      return data?.content || generateFallbackNewsletter(campaignTitle, weekNumber);
    } catch (error) {
      console.error('Error generating newsletter:', error);
      return generateFallbackNewsletter(campaignTitle, weekNumber);
    }
  };

  const generateFallbackNewsletter = (campaignTitle: string, weekNumber: number) => {
    return `🌿 WEEKLY GARDEN NEWSLETTER - WEEK ${weekNumber}

Dear Garden Enthusiasts,

Welcome to another exciting week at our garden center! This week, we're focusing on ${campaignTitle}, and we have some wonderful insights to share with you.

🌱 FEATURED THIS WEEK: ${campaignTitle}

Spring is in full swing, and it's the perfect time to focus on ${campaignTitle.toLowerCase()}. Whether you're a seasoned gardener or just getting started, understanding the right techniques can make all the difference in your garden's success.

Our expert team has been busy preparing special recommendations for this week's theme. We've carefully selected plants, tools, and supplies that will help you achieve amazing results in your garden.

🌸 WHAT'S HAPPENING AT THE GARDEN CENTER

This week, we're excited to offer personalized consultations where our knowledgeable staff can help you plan your garden strategy. We've also received fresh shipments of seasonal plants that are perfect for this time of year.

Don't miss our weekend workshop where we'll demonstrate hands-on techniques related to ${campaignTitle.toLowerCase()}. It's a great opportunity to learn from the experts and connect with fellow gardening enthusiasts.

🌿 GARDEN TIP OF THE WEEK

The key to successful ${campaignTitle.toLowerCase()} is timing and preparation. Start by observing your garden's unique conditions - soil type, sunlight patterns, and drainage. This foundation knowledge will guide all your gardening decisions.

🌻 VISIT US TODAY

Stop by the garden center this week to explore our latest arrivals and get personalized advice for your specific gardening goals. Our team is always here to help you create the garden of your dreams!

Happy gardening!
The Garden Center Team

P.S. Follow us on social media for daily gardening tips and inspiration! 🌱`;
  };

  const generateVideoScript = (campaignTitle: string, seasonalContent: any) => {
    const theme = campaignTitle.toLowerCase();
    
    return `Hey garden lovers! Are you struggling with ${theme} in your garden? You're not alone, and I've got some game-changing tips that will transform your results.

I've been helping gardeners for over fifteen years, and I see the same mistakes over and over again. Most people think ${theme} is complicated, but it doesn't have to be.

Here's what I want you to understand: successful ${theme} comes down to three simple principles that anyone can master.

First, timing is everything. The most successful gardeners I know don't wait for problems to appear - they're always one step ahead, preparing their gardens before issues arise.

Second, it's not about expensive products or complicated techniques. Some of the most effective methods I'll show you cost almost nothing but deliver incredible results.

And here's the secret that separates successful gardeners from everyone else: they understand that every garden is unique. What works in one yard might need adjustments in another, and that's perfectly normal.

The key is learning to read your garden's signals. Your plants are constantly communicating with you - you just need to know what to look for.

This week, I want you to start paying closer attention to these natural indicators. Come visit us at the garden center, and I'll show you exactly what to watch for in your own space.

What's your biggest challenge with ${theme}? Share it in the comments below, and I'll give you specific advice for your situation. Let's grow together!`;
   };

  // Clean up duplicates function
  const cleanupDuplicatesForCampaign = async (campaignId: string) => {
    try {
      // Get all tasks for this campaign
      const { data: allTasks, error } = await supabase
        .from('content_tasks')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true });

      if (error || !allTasks) return;

      // Group by post_type and keep only the first one of each type
      const tasksByType = allTasks.reduce((acc: any, task: any) => {
        if (!acc[task.post_type]) {
          acc[task.post_type] = task;
        }
        return acc;
      }, {});

      // Find tasks to delete (duplicates)
      const tasksToKeep = Object.values(tasksByType).map((task: any) => task.id);
      const tasksToDelete = allTasks.filter(task => !tasksToKeep.includes(task.id));

      if (tasksToDelete.length > 0) {
        console.log('Removing duplicate tasks:', tasksToDelete.map(t => `${t.post_type} (${t.id})`));
        
        const { error: deleteError } = await supabase
          .from('content_tasks')
          .delete()
          .in('id', tasksToDelete.map(t => t.id));

        if (deleteError) {
          console.error('Error deleting duplicate tasks:', deleteError);
        } else {
          console.log('Successfully cleaned up duplicates');
        }
      }
    } catch (error) {
      console.error('Error cleaning up duplicates:', error);
    }
  };

  // Update existing video tasks with new script
  const updateVideoTasksWithNewScript = async (campaignId: string, campaignTitle: string) => {
    try {
      const seasonalContent = getSeasonalContent();
      const newVideoScript = generateVideoScript(campaignTitle, seasonalContent);
      
      const { error } = await supabase
        .from('content_tasks')
        .update({ ai_output: newVideoScript })
        .eq('campaign_id', campaignId)
        .eq('post_type', 'video');

      if (error) {
        console.error('Error updating video script:', error);
      } else {
        console.log('Video script updated with fresh content');
        if (onTaskUpdate) onTaskUpdate();
      }
    } catch (error) {
      console.error('Error updating video script:', error);
    }
  };

  // Auto-create current week campaign if none exists
  useEffect(() => {
    const autoCreateCurrentWeekCampaign = async () => {
      console.log('Auto-create effect running with campaigns:', campaigns.length);
      let currentCampaign = getCurrentWeekCampaign(campaigns);
      console.log('Current campaign found:', currentCampaign);
      
      // If we have a campaign, check if it needs content generation
      if (currentCampaign) {
        // First clean up any existing duplicates
        await cleanupDuplicatesForCampaign(currentCampaign.id);
        
        // Update video task with new script
        await updateVideoTasksWithNewScript(currentCampaign.id, currentCampaign.title);
        
        // Then check if we need to generate tasks
        const campaignTasks = getTasksForCampaign(tasks, currentCampaign.id);
        console.log('Campaign tasks found:', campaignTasks.length);
        
        if (campaignTasks.length === 0) {
          console.log('No tasks found, generating required tasks...');
          await generateRequiredTasks(currentCampaign.id.toString());
        } else {
          // Check for missing required task types
          const requiredTypes = ['newsletter', 'instagram', 'facebook', 'email', 'video'];
          const existingTypes = campaignTasks.map(task => task.post_type);
          const missingTypes = requiredTypes.filter(type => !existingTypes.includes(type));
          
          if (missingTypes.length > 0) {
            console.log('Creating missing task types:', missingTypes);
            await createMissingTasks(currentCampaign.id.toString(), missingTypes, currentCampaign.title);
          }
        }
      }
    };

    if (campaigns.length > 0) {
      autoCreateCurrentWeekCampaign();
    }
  }, [campaigns, tasks]);

  const createMissingTasks = async (campaignId: string, missingTypes: string[], campaignTitle: string) => {
    try {
      const today = new Date();
      const seasonalContent = getSeasonalContent();
      const weekNumber = getCurrentWeekNumber();
      
      const tasksToCreate = [];
      
      for (let i = 0; i < missingTypes.length; i++) {
        const postType = missingTypes[i];
        const scheduledDate = new Date(today);
        scheduledDate.setDate(today.getDate() + i + 1);
        
        let aiOutput = '';
        
        if (postType === 'newsletter') {
          aiOutput = await generateNewsletterContent(campaignId, campaignTitle, weekNumber);
        } else if (postType === 'video') {
          aiOutput = generateVideoScript(campaignTitle, seasonalContent);
        } else {
          aiOutput = getContentForType(postType, seasonalContent);
        }
        
        tasksToCreate.push({
          campaign_id: campaignId,
          post_type: postType,
          status: 'review',
          scheduled_date: scheduledDate.toISOString().split('T')[0],
          ai_output: aiOutput,
          hashtags: getHashtagsForType(postType),
          image_idea: getImageIdeaForType(postType)
        });
      }

      console.log('Creating missing tasks:', tasksToCreate);

      const { error } = await supabase
        .from('content_tasks')
        .insert(tasksToCreate);
      
      if (error) {
        console.error('Error creating missing tasks:', error);
      } else {
        console.log('Missing tasks created successfully');
        if (onTaskUpdate) onTaskUpdate();
      }
    } catch (error) {
      console.error('Error creating missing tasks:', error);
    }
  };

  const generateRequiredTasks = async (campaignId: string) => {
    setIsGeneratingTasks(true);
    
    try {
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) return;

      const today = new Date();
      const seasonalContent = getSeasonalContent();
      const weekNumber = getCurrentWeekNumber();
      
      // Generate exactly 5 required tasks
      const requiredTypes = ['newsletter', 'instagram', 'facebook', 'email', 'video'];
      const sampleTasks = [];
      
      for (let i = 0; i < requiredTypes.length; i++) {
        const postType = requiredTypes[i];
        const scheduledDate = new Date(today);
        scheduledDate.setDate(today.getDate() + i + 1);
        
        let aiOutput = '';
        
        if (postType === 'newsletter') {
          aiOutput = await generateNewsletterContent(campaignId, campaign.title, weekNumber);
        } else if (postType === 'video') {
          aiOutput = generateVideoScript(campaign.title, seasonalContent);
        } else {
          aiOutput = getContentForType(postType, seasonalContent);
        }
        
        sampleTasks.push({
          campaign_id: campaignId,
          post_type: postType,
          status: 'review',
          scheduled_date: scheduledDate.toISOString().split('T')[0],
          ai_output: aiOutput,
          hashtags: getHashtagsForType(postType),
          image_idea: getImageIdeaForType(postType)
        });
      }

      console.log('Auto-generating required tasks:', sampleTasks);

      const { data, error } = await supabase
        .from('content_tasks')
        .insert(sampleTasks)
        .select();
      
      if (error) {
        console.error('Error creating tasks:', error);
      } else {
        console.log('Tasks created successfully:', data);
      }

      if (onTaskUpdate) {
        onTaskUpdate();
      }
      
    } catch (error) {
      console.error('Error generating tasks:', error);
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const getContentForType = (postType: string, seasonalContent: any) => {
    switch (postType) {
      case 'instagram':
        const instaPost = seasonalContent.posts.find((p: any) => p.type === 'instagram');
        return instaPost?.content || '🌱 Transform your garden this week with expert tips! Our team has been perfecting these techniques for years, and now we\'re sharing them with you. Visit us today for personalized advice and quality plants. #GardenLife #PlantParent #GrowWithUs';
      case 'facebook':
        const fbPost = seasonalContent.posts.find((p: any) => p.type === 'facebook');
        return fbPost?.content || 'Spring is the perfect time to focus on your garden goals! Our expert team is here to help you succeed with personalized consultations, quality plants, and proven techniques. Stop by this week to see what\'s new and get advice tailored to your unique garden. What are your gardening plans for this season?';
      case 'email':
        const emailContent = seasonalContent.posts.find((p: any) => p.type === 'email');
        return emailContent?.content || 'Don\'t miss this week\'s special focus on seasonal gardening techniques! We\'ve prepared expert recommendations, fresh plant arrivals, and exclusive tips just for our email subscribers. Plus, join us for our weekend workshop where you\'ll learn hands-on skills from our experienced team.';
      default:
        return `Expert gardening advice and quality plants for your ${postType} audience.`;
    }
  };

  const getHashtagsForType = (postType: string) => {
    switch (postType) {
      case 'newsletter':
        return '#WeeklyNewsletter #GardenTips #Community';
      case 'instagram':
        return '#GardenLife #Plants #Instagram #GreenThumb';
      case 'facebook':
        return '#GardenCenter #Community #Facebook #Gardening';
      case 'email':
        return '#Newsletter #EmailMarketing #GardenTips';
      case 'video':
        return '#GardenVideo #Tutorial #HowTo #Gardening';
      default:
        return `#${postType} #WeeklyCampaign #Gardening`;
    }
  };

  const getImageIdeaForType = (postType: string) => {
    switch (postType) {
      case 'newsletter':
        return 'Newsletter header with seasonal garden imagery';
      case 'instagram':
        return 'Square format photo of featured plants or garden scene';
      case 'facebook':
        return 'Landscape photo showcasing garden center or seasonal plants';
      case 'email':
        return 'Email header with garden center branding and seasonal elements';
      case 'video':
        return 'Video thumbnail with gardening tools and plants';
      default:
        return `${postType} post image idea`;
    }
  };

  const currentCampaign = getCurrentWeekCampaign(campaigns);
  const campaignTasks = currentCampaign ? getTasksForCampaign(tasks, currentCampaign.id) : [];
  const overdueTasks = getOverdueTasks(tasks);
  const setupProgress = getSetupProgress(onboardingData, campaigns, tasks);
  const upcomingContent = getUpcomingContent(tasks);

  console.log('Rendering Homepage with:', {
    currentCampaign: currentCampaign?.title,
    campaignTasks: campaignTasks.length,
    requiredTypes: ['newsletter', 'instagram', 'facebook', 'email', 'video'],
    isGeneratingTasks
  });

  return (
    <div className="min-h-screen bg-garden-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <WelcomeSection />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* This Week's Campaign - Spans 2 columns */}
          <div className="lg:col-span-2">
            <WeekCampaignCard
              currentCampaign={currentCampaign}
              campaignTasks={campaignTasks}
              isGeneratingTasks={isGeneratingTasks || isCreatingCampaign}
              onTaskClick={onTaskClick}
              onTaskUpdate={onTaskUpdate}
            />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <SetupProgressCard setupProgress={setupProgress} />
            <CampaignTasksCard overdueTasks={overdueTasks} />
            <UpcomingContentCard upcomingContent={upcomingContent} />
          </div>
        </div>

        <QuickActionsGrid />

        {/* Task Checklist and Workflow Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <TaskChecklist 
              campaignTitle={currentCampaign?.title}
              weekNumber={getCurrentWeekNumber()}
            />
          </div>
          
          <div>
            <ContentPipelineCard
              tasks={tasks}
              onNavigateToKanban={onNavigateToKanban}
              onTaskClick={onTaskClick}
            />
          </div>
        </div>

        <AnalyticsSnapshot campaigns={campaigns} tasks={tasks} />
      </div>
    </div>
  );
};
