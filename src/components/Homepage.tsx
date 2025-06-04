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
        
        // Delete duplicates
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
        console.log('Campaign tasks details:', campaignTasks.map(t => ({ id: t.id, type: t.post_type, hasContent: !!t.ai_output })));
        
        if (campaignTasks.length === 0) {
          console.log('No tasks found, generating sample tasks...');
          await generateSampleTasks(currentCampaign.id.toString());
        } else {
          // Check if we need to generate AI newsletter content
          const newsletterTask = campaignTasks.find(task => task.post_type === 'newsletter');
          const otherTasks = campaignTasks.filter(task => task.post_type !== 'newsletter');
          
          console.log('Newsletter task found:', newsletterTask);
          console.log('Newsletter has content:', newsletterTask?.ai_output);
          console.log('Other tasks with content:', otherTasks.filter(task => task.ai_output).length);
          
          // If no newsletter task exists, create one
          if (!newsletterTask && otherTasks.length > 0) {
            console.log('Creating missing newsletter task...');
            await createNewsletterTask(currentCampaign.id.toString());
          }
          // If newsletter exists but has no AI content, and other tasks have content, generate newsletter
          else if (newsletterTask && (!newsletterTask.ai_output || newsletterTask.ai_output.trim() === '') && otherTasks.some(task => task.ai_output)) {
            console.log('Triggering AI newsletter generation...');
            await generateAINewsletter(currentCampaign.id.toString(), currentCampaign.title, getCurrentWeekNumber());
          }
        }
      }
    };

    if (campaigns.length > 0) {
      autoCreateCurrentWeekCampaign();
    }
  }, [campaigns, tasks]);

  const createNewsletterTask = async (campaignId: string) => {
    try {
      const today = new Date();
      const scheduledDate = new Date(today);
      scheduledDate.setDate(today.getDate() + 5); // Schedule newsletter 5 days from today

      const { error } = await supabase
        .from('content_tasks')
        .insert({
          campaign_id: campaignId,
          post_type: 'newsletter',
          status: 'review',
          scheduled_date: scheduledDate.toISOString().split('T')[0],
          ai_output: '', // Will be generated by AI
          hashtags: '#WeeklyNewsletter #GardenTips #Community',
          image_idea: 'Newsletter header with seasonal garden imagery'
        });

      if (error) {
        console.error('Error creating newsletter task:', error);
      } else {
        console.log('Newsletter task created successfully');
        if (onTaskUpdate) onTaskUpdate();
      }
    } catch (error) {
      console.error('Error creating newsletter task:', error);
    }
  };

  const generateAINewsletter = async (campaignId: string, campaignTitle: string, weekNumber: number) => {
    try {
      console.log('Generating AI newsletter for campaign:', campaignId);
      
      const { data, error } = await supabase.functions.invoke('generate-newsletter', {
        body: {
          campaignId,
          campaignTitle,
          weekNumber
        }
      });

      if (error) {
        console.error('Error calling newsletter generation function:', error);
        return;
      }

      console.log('Newsletter generation response:', data);

      if (data && data.content) {
        // Update the newsletter task with AI-generated content
        const { error: updateError } = await supabase
          .from('content_tasks')
          .update({
            ai_output: data.content,
            hashtags: data.hashtags || '#WeeklyNewsletter #GardenTips #Community',
            image_idea: data.imageIdea || 'Newsletter header with seasonal garden imagery'
          })
          .eq('campaign_id', campaignId)
          .eq('post_type', 'newsletter');

        if (updateError) {
          console.error('Error updating newsletter task:', updateError);
        } else {
          console.log('Successfully generated and saved AI newsletter content');
          if (onTaskUpdate) {
            onTaskUpdate();
          }
        }
      }
    } catch (error) {
      console.error('Error generating AI newsletter:', error);
    }
  };

  const generateSampleTasks = async (campaignId: string) => {
    setIsGeneratingTasks(true);
    
    try {
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) return;

      // Double-check that no tasks exist for this campaign
      const { data: existingTasksCheck, error: checkError } = await supabase
        .from('content_tasks')
        .select('id, post_type')
        .eq('campaign_id', campaignId);

      if (checkError) {
        console.error('Error checking existing tasks:', checkError);
        return;
      }

      if (existingTasksCheck && existingTasksCheck.length > 0) {
        console.log('Tasks already exist for this campaign, skipping generation');
        return;
      }

      const today = new Date();
      const seasonalContent = getSeasonalContent();
      
      console.log('Seasonal content structure:', seasonalContent);
      
      // Generate exactly 4 tasks - one for each required type INCLUDING newsletter
      const requiredTypes = ['instagram', 'facebook', 'email', 'newsletter'];
      const sampleTasks = requiredTypes.map((postType, index) => {
        const scheduledDate = new Date(today);
        // Spread posts across the week: today, +1 day, +3 days, +5 days
        scheduledDate.setDate(today.getDate() + index + (index > 0 ? index : 0));
        
        // Find the matching content for this post type or use newsletter placeholder
        let postContent;
        if (postType === 'newsletter') {
          postContent = {
            content: '', // Will be generated by AI after other content is created
            hashtags: '#WeeklyNewsletter #GardenTips #Community',
            imageIdea: 'Newsletter header with seasonal garden imagery'
          };
        } else {
          postContent = seasonalContent.posts.find(post => post.type === postType);
        }
        
        console.log(`Finding content for ${postType}:`, postContent);
        
        return {
          campaign_id: campaignId,
          post_type: postType,
          status: 'review',
          scheduled_date: scheduledDate.toISOString().split('T')[0],
          ai_output: postContent?.content || `Generated ${postType} content for this week's campaign - seasonal content will be added here automatically`,
          hashtags: postContent?.hashtags || `#${postType} #WeeklyCampaign #SeasonalContent`,
          image_idea: postContent?.imageIdea || `${postType} post image idea`
        };
      });

      console.log('Auto-generating tasks with proper content mapping including newsletter:', sampleTasks);

      // Insert tasks into the database in a single batch to prevent duplicates
      const { data, error } = await supabase
        .from('content_tasks')
        .insert(sampleTasks)
        .select();
      
      if (error) {
        console.error('Error creating tasks:', error);
      } else {
        console.log('Tasks created successfully:', data);
        
        // Generate AI newsletter content after other tasks are created
        setTimeout(async () => {
          console.log('Triggering delayed AI newsletter generation...');
          await generateAINewsletter(campaignId, campaign.title, getCurrentWeekNumber());
        }, 3000); // Wait 3 seconds to ensure other content is available
      }

      // Refresh the page to show new tasks
      if (onTaskUpdate) {
        onTaskUpdate();
      }
      
    } catch (error) {
      console.error('Error generating tasks:', error);
    } finally {
      setIsGeneratingTasks(false);
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
