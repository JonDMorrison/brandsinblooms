
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
        return 'This week\'s gardening newsletter will feature seasonal tips, plant care advice, and community updates. Content will be AI-generated based on the week\'s theme.';
      }

      return data?.content || 'This week\'s gardening newsletter will feature seasonal tips, plant care advice, and community updates. Content will be AI-generated based on the week\'s theme.';
    } catch (error) {
      console.error('Error generating newsletter:', error);
      return 'This week\'s gardening newsletter will feature seasonal tips, plant care advice, and community updates. Content will be AI-generated based on the week\'s theme.';
    }
  };

  const generateVideoScript = (campaignTitle: string, seasonalContent: any) => {
    const theme = campaignTitle.toLowerCase();
    
    return `📹 3-MINUTE INSTRUCTIONAL VIDEO SCRIPT: ${campaignTitle}

🎣 HOOK (0-15 seconds):
"Are you struggling with ${theme}? Today I'm going to show you exactly how to solve this problem in just 3 minutes!"

😰 AGITATE THE PAIN (15-45 seconds):
"I know how frustrating it can be when your plants aren't thriving. You've spent time, money, and effort, but you're still not seeing the results you want. The problem is most gardeners don't know the simple techniques that make all the difference with ${theme}."

📚 INSTRUCTION (45 seconds - 2:45 minutes):
"Here's what you need to do:

Step 1: [Key technique for ${theme}]
- Explain the first essential step
- Show the proper method
- Common mistakes to avoid

Step 2: [Supporting action]
- Demonstrate the technique
- Share pro tips for best results

Step 3: [Final step for success]
- Wrap up with the completion technique
- Show the expected outcome"

🎯 CALL TO ACTION (2:45-3:00 minutes):
"There you have it! Follow these three steps and you'll see amazing results with ${theme}. If you found this helpful, visit our garden center for personalized advice and all the supplies you need. What gardening topic should we cover next? Let us know in the comments!"

🎬 VISUAL NOTES:
- Show close-ups of techniques
- Include before/after shots
- Keep pacing energetic and engaging
- Use natural outdoor lighting when possible`;
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
