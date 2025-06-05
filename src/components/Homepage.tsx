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

Dear Garden Friends,

Welcome to this week's edition focusing on ${campaignTitle}! As we embrace the beauty of the season, we're excited to share essential tips and insights that will help your garden flourish.

This week, we're diving deep into ${campaignTitle.toLowerCase()}, a crucial aspect of successful gardening that many overlook. Whether you're a seasoned gardener or just starting your green journey, understanding these principles will transform your gardening experience.

Our expert team has been working tirelessly to bring you the most effective techniques for ${campaignTitle.toLowerCase()}. From soil preparation to plant selection, we've got you covered with practical advice you can implement immediately.

Don't forget to visit our garden center this week for personalized consultations and to explore our latest arrivals. Our knowledgeable staff is always ready to help you achieve your gardening goals.

We're also excited to announce our upcoming community workshop where we'll demonstrate hands-on techniques related to this week's theme. Spaces are limited, so be sure to register early.

Happy gardening!
The Garden Center Team

Visit us today for expert advice and quality plants! 🌱`;
  };

  const generateVideoScript = (campaignTitle: string, seasonalContent: any) => {
    const theme = campaignTitle.toLowerCase();
    
    return `Hey there, fellow gardeners! Are you tired of watching your plants struggle with ${theme}? I've been helping gardeners for over fifteen years, and today I'm sharing the three game-changing secrets that will completely transform your results.

Look, I get it. You've probably tried everything - different fertilizers, watering schedules, maybe even moved your plants around multiple times. But here's the thing most gardeners don't realize: successful ${theme} isn't about having a green thumb, it's about understanding exactly what your plants need and when they need it.

Let me share what I've learned from working with thousands of gardeners. First, timing is absolutely everything. Most people start working on ${theme} when they see problems, but the pros? They're already three steps ahead, preparing before issues even appear.

Second, it's not about spending more money on expensive products. The most successful gardeners I know use simple, proven techniques that cost almost nothing but deliver incredible results. I'm talking about methods that have been working for generations.

And here's the secret that separates the pros from everyone else: they understand that every garden is unique. What works in one yard might not work in another, and that's perfectly normal. The key is knowing how to adapt these core principles to your specific situation.

Here's what I want you to do this week. Start paying attention to your plants' signals - they're constantly telling you what they need if you know how to listen. Come visit us at the garden center, and I'll show you exactly what to look for in your own garden.

What's your biggest challenge with ${theme} right now? Drop a comment below, and I'll personally respond with specific advice for your situation!`;
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
        return instaPost?.content || 'Beautiful Instagram post showcasing this week\'s featured plants and gardening tips.';
      case 'facebook':
        const fbPost = seasonalContent.posts.find((p: any) => p.type === 'facebook');
        return fbPost?.content || 'Engaging Facebook post with community gardening tips and seasonal plant highlights.';
      case 'email':
        const emailContent = seasonalContent.posts.find((p: any) => p.type === 'email');
        return emailContent?.content || 'Weekly email campaign featuring special offers, gardening tips, and upcoming events.';
      default:
        return `Generated ${postType} content for this week's campaign.`;
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
