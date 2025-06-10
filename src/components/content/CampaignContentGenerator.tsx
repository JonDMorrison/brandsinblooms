
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generatePersonalizedContent, generateNewsletterContent, generateVideoScript } from "@/components/homepage/TaskGenerationUtils";
import { useAuth } from "@/contexts/AuthContext";

interface CampaignContentGeneratorProps {
  campaignId: string;
  campaignTitle: string;
  onContentGenerated: () => void;
}

export const CampaignContentGenerator = ({ 
  campaignId, 
  campaignTitle, 
  onContentGenerated 
}: CampaignContentGeneratorProps) => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAllContentTypes = async () => {
    if (!user) {
      toast.error("Please log in to generate content");
      return;
    }

    setIsGenerating(true);
    console.log('Starting content generation for campaign:', campaignId);

    try {
      // First, check what content types already exist
      const { data: existingTasks, error: fetchError } = await supabase
        .from('content_tasks')
        .select('post_type')
        .eq('campaign_id', campaignId);

      if (fetchError) {
        console.error('Error checking existing tasks:', fetchError);
        throw new Error('Failed to check existing content');
      }

      const existingTypes = existingTasks?.map(t => t.post_type) || [];
      const allTypes = ['facebook', 'instagram', 'email', 'newsletter', 'video'];
      const missingTypes = allTypes.filter(type => !existingTypes.includes(type));

      console.log('Existing types:', existingTypes);
      console.log('Missing types:', missingTypes);

      if (missingTypes.length === 0) {
        toast.info('All content types already exist for this campaign');
        return;
      }

      // Create tasks for missing types
      const today = new Date();
      const tasksToCreate = [];

      for (let i = 0; i < missingTypes.length; i++) {
        const postType = missingTypes[i];
        const scheduledDate = new Date(today);
        scheduledDate.setDate(today.getDate() + i + 1);

        tasksToCreate.push({
          campaign_id: campaignId,
          post_type: postType,
          status: 'planned',
          scheduled_date: scheduledDate.toISOString().split('T')[0],
        });
      }

      console.log('Creating tasks:', tasksToCreate);

      // Insert the missing tasks
      const { data: createdTasks, error: insertError } = await supabase
        .from('content_tasks')
        .insert(tasksToCreate)
        .select();

      if (insertError) {
        console.error('Error creating tasks:', insertError);
        throw new Error('Failed to create content tasks');
      }

      console.log('Created tasks:', createdTasks);

      // Now generate content for all tasks (including existing ones without content)
      const { data: allTasks, error: allTasksError } = await supabase
        .from('content_tasks')
        .select('*')
        .eq('campaign_id', campaignId)
        .is('ai_output', null);

      if (allTasksError) {
        console.error('Error fetching tasks for generation:', allTasksError);
        throw new Error('Failed to fetch tasks for content generation');
      }

      console.log('Tasks needing content generation:', allTasks);

      // Generate content for each task
      for (const task of allTasks || []) {
        console.log(`Generating content for ${task.post_type} task:`, task.id);

        try {
          // Update status to generating
          await supabase
            .from('content_tasks')
            .update({ status: 'generating' })
            .eq('id', task.id);

          let aiOutput = '';

          // Generate content based on type
          if (task.post_type === 'newsletter') {
            aiOutput = await generateNewsletterContent(
              campaignId, 
              campaignTitle, 
              Math.ceil(Date.now() / (7 * 24 * 60 * 60 * 1000)), // rough week number
              user.id
            );
          } else if (task.post_type === 'video') {
            aiOutput = await generateVideoScript(campaignTitle, user.id);
          } else {
            aiOutput = await generatePersonalizedContent(
              task.post_type, 
              campaignTitle, 
              user.id
            );
          }

          // Update task with generated content
          const { error: updateError } = await supabase
            .from('content_tasks')
            .update({ 
              ai_output: aiOutput,
              status: 'draft',
              hashtags: getHashtagsForType(task.post_type),
              image_idea: getImageIdeaForType(task.post_type)
            })
            .eq('id', task.id);

          if (updateError) {
            console.error(`Error updating ${task.post_type} task:`, updateError);
          } else {
            console.log(`Successfully generated ${task.post_type} content`);
          }

        } catch (contentError) {
          console.error(`Error generating ${task.post_type} content:`, contentError);
          
          // Reset status back to planned if generation fails
          await supabase
            .from('content_tasks')
            .update({ status: 'planned' })
            .eq('id', task.id);
        }
      }

      toast.success(`Content generation completed! Generated content for ${missingTypes.length} new content types.`);
      onContentGenerated();

    } catch (error) {
      console.error('Error in generateAllContentTypes:', error);
      toast.error(`Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const getHashtagsForType = (postType: string): string => {
    const hashtagsMap: Record<string, string> = {
      instagram: '#business #entrepreneur #success #motivation #growth',
      facebook: '#business #community #update #news',
      email: '',
      newsletter: '',
      video: '#video #content #business #tips'
    };
    
    return hashtagsMap[postType] || '#business #content';
  };

  const getImageIdeaForType = (postType: string): string => {
    const imageIdeasMap: Record<string, string> = {
      instagram: 'Professional photo with engaging visual elements',
      facebook: 'Community-focused image or infographic',
      email: 'Simple header image or company logo',
      newsletter: 'Newsletter banner with company branding',
      video: 'Thumbnail image for video content'
    };
    
    return imageIdeasMap[postType] || 'Professional business image';
  };

  return (
    <div className="flex justify-center p-4">
      <Button 
        onClick={generateAllContentTypes}
        disabled={isGenerating}
        className="bg-purple-600 hover:bg-purple-700 text-white"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating Content...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate All Missing Content
          </>
        )}
      </Button>
    </div>
  );
};
