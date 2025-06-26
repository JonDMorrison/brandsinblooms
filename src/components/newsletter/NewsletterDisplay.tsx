
import React, { useEffect, useState } from 'react';
import { MagazineNewsletterDisplay } from '../content-sidebar/MagazineNewsletterDisplay';
import { normalizeTask } from '@/utils/normalizeTask';
import { validateContentCompliance } from '@/utils/campaignTitleUtils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface NewsletterDisplayProps {
  task: any;
}

export const NewsletterDisplay = ({ task }: NewsletterDisplayProps) => {
  const { user } = useAuth();
  const [newsletterContent, setNewsletterContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Normalize the task to ensure consistent format
  const normalizedTask = normalizeTask(task);
  const content = normalizedTask.ai_output;
  
  // Validate content compliance for debugging
  if (import.meta.env.DEV) {
    const validation = validateContentCompliance(content);
    if (!validation.isValid) {
      console.warn('Newsletter content validation issues:', validation.issues);
    }
  }

  // Check if content needs to be generated or is placeholder
  const isPlaceholderContent = !content || 
    content.includes('Seasonal Gardening Focus - Week') ||
    content.includes('This week\'s theme:') ||
    content.length < 100;

  const generateNewsletterContent = async () => {
    if (!user || !task?.campaign_id) {
      console.error('Missing user or campaign_id for newsletter generation');
      return;
    }

    setIsGenerating(true);
    setHasError(false);
    
    try {
      console.log('🔄 Generating newsletter content for campaign:', task.campaign_id);
      
      const { data: result, error } = await supabase.functions.invoke('generate-newsletter', {
        body: {
          campaignId: task.campaign_id,
          userId: user.id
        }
      });

      if (error) {
        console.error('❌ Newsletter generation error:', error);
        
        if (error.message?.includes('shouldGenerateContent')) {
          toast.error('Please generate campaign content first, then try the newsletter again.');
        } else {
          toast.error(`Newsletter generation failed: ${error.message}`);
        }
        setHasError(true);
        return;
      }

      if (result?.content) {
        console.log('✅ Newsletter generated successfully');
        setNewsletterContent(result.content);
        
        // Update the task with the generated newsletter content
        const { error: updateError } = await supabase
          .from('content_tasks')
          .update({
            ai_output: result.content,
            status: 'review'
          })
          .eq('id', task.id);
        
        if (updateError) {
          console.error('❌ Error updating newsletter task:', updateError);
        } else {
          toast.success('Newsletter generated successfully!');
        }
      } else {
        console.error('❌ No content returned from newsletter generation');
        setHasError(true);
      }
    } catch (error) {
      console.error('❌ Newsletter generation failed:', error);
      toast.error('Failed to generate newsletter content');
      setHasError(true);
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-generate if content is placeholder
  useEffect(() => {
    if (isPlaceholderContent && !isGenerating && !hasError && user && task?.campaign_id) {
      console.log('🔄 Auto-generating newsletter content for placeholder');
      generateNewsletterContent();
    }
  }, [isPlaceholderContent, user, task?.campaign_id]);

  // Use generated content if available, otherwise use original content
  const displayContent = newsletterContent || content;

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-gray-600">Generating your newsletter content...</p>
        <p className="text-sm text-gray-500">This may take a few moments</p>
      </div>
    );
  }

  if (hasError || isPlaceholderContent) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4 bg-gray-50 rounded-lg">
        <p className="text-gray-600 text-center">
          {hasError ? 
            'There was an issue generating your newsletter content.' :
            'Newsletter content is being prepared for you.'
          }
        </p>
        <Button 
          onClick={generateNewsletterContent}
          disabled={isGenerating}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          {hasError ? 'Try Again' : 'Generate Newsletter'}
        </Button>
      </div>
    );
  }
  
  // ALWAYS use MagazineNewsletterDisplay for ALL newsletters
  // This ensures consistent enhanced display regardless of content format
  // Debug logging to see what's being passed
  console.log('📧 Newsletter Display Debug:', {
    hasContent: !!displayContent,
    contentLength: displayContent?.length || 0,
    contentPreview: displayContent?.substring(0, 100),
    normalizedTask: normalizedTask
  });
  
  // Remove prose constraints to allow full magazine layout
  return (
    <div className="w-full">
      <MagazineNewsletterDisplay 
        content={displayContent} 
        contentTaskId={task.id}
        campaignTitle={task.campaigns?.theme}
      />
    </div>
  );
};

export default NewsletterDisplay;
