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

      // Extract clean content from the response
      if (data?.content) {
        // If it's an object with content property, use that
        if (typeof data.content === 'object' && data.content.content) {
          return data.content.content;
        }
        // If it's already a string, use it directly
        if (typeof data.content === 'string') {
          return data.content;
        }
      }

      return generateFallbackNewsletter(campaignTitle, weekNumber);
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

Spring is the perfect time to dive deep into ${campaignTitle.toLowerCase()}. Whether you're a seasoned gardener or just starting your green journey, mastering these techniques will transform your garden into a thriving oasis.

Our expert team has been busy curating the best products, plants, and advice specifically for this week's focus. We believe that success in gardening comes from understanding both the science and the art behind each practice.

🌸 WHAT'S HAPPENING AT THE GARDEN CENTER

This week brings exciting developments to our garden center. We've received fresh shipments of premium plants perfect for the current season, and our greenhouse is bursting with healthy specimens ready for their new homes.

Join us for our weekend workshop series where we'll dive hands-on into the world of ${campaignTitle.toLowerCase()}. These sessions are designed to give you practical skills you can immediately apply in your own garden.

🌿 EXPERT TIP OF THE WEEK

The secret to mastering ${campaignTitle.toLowerCase()} lies in understanding your garden's unique microclimate. Take time to observe how sunlight moves across your space, where water naturally collects, and how your soil responds to different conditions.

Remember: every garden tells a story, and your job as a gardener is to listen carefully and respond thoughtfully to what your plants are telling you.

🌻 COMMUNITY SPOTLIGHT

We love seeing the incredible transformations happening in our customers' gardens! This week, we're inspired by the creative approaches our community members are taking with ${campaignTitle.toLowerCase()}.

Stop by and share your own garden photos with us - we'd love to feature your success story in next week's newsletter!

🌱 VISIT US THIS WEEK

Come experience the difference that expert guidance and quality plants can make in your gardening journey. Our knowledgeable team is here to help you succeed with personalized advice tailored to your specific needs.

Happy gardening, and remember - every day is a chance to grow something beautiful!

The Garden Center Team

P.S. Follow us on social media for daily inspiration and quick tips! 🌱`;
  };

  const generateVideoScript = (campaignTitle: string, seasonalContent: any) => {
    const theme = campaignTitle.toLowerCase();
    
    return `Hey there, fellow garden lovers! Today I want to talk about something that's been on my mind - ${theme}. If you've been struggling with this in your garden, you're definitely not alone.

I've been helping gardeners for over fifteen years now, and I can tell you that ${theme} doesn't have to be complicated. In fact, some of the best results I've seen come from understanding just a few key principles.

Here's what I've learned: most people overthink ${theme}. They get caught up in complex techniques and expensive products when really, nature has already given us everything we need to succeed.

The first thing to understand is timing. Your garden operates on its own schedule, and working with that rhythm rather than against it makes all the difference. When you start paying attention to these natural signals, everything becomes clearer.

Second, it's about observation. Your plants are constantly communicating with you - through their leaves, their growth patterns, even how they respond to watering. Learning to read these signs is like having a conversation with your garden.

And here's the secret that separates successful gardeners from everyone else: consistency beats intensity every time. Small, regular actions compound into amazing results.

This week, I challenge you to spend just five minutes each day really observing your garden. Notice what's thriving, what's struggling, and how different areas respond to your care.

Come visit us at the garden center this week, and I'll show you exactly what to look for in your own space. We'll walk through some simple techniques that can dramatically improve your results with ${theme}.

What's your biggest challenge with ${theme} right now? Drop a comment below and let's solve it together!`;
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
