import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface NewsletterRegeneratorProps {
  contentTaskId?: string;
  campaignTitle?: string;
  regenerating: boolean;
  setRegenerating: (regenerating: boolean) => void;
}

export const NewsletterRegenerator: React.FC<NewsletterRegeneratorProps> = ({
  contentTaskId,
  campaignTitle,
  regenerating,
  setRegenerating
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const regenerateNewsletter = async () => {
    if (!user || !contentTaskId) {
      console.error('❌ Missing required data:', { user: !!user, contentTaskId });
      toast({
        title: "Error",
        description: "Unable to regenerate newsletter - missing required information",
        variant: "destructive",
      });
      return;
    }

    setRegenerating(true);
    console.log('🔄 Starting newsletter regeneration for task:', contentTaskId);

    try {
      // First, get the user's company profile for business context
      console.log('🔄 Fetching company profile...');
      const { data: profile, error: profileError } = await supabase
        .from('company_profiles')
        .select('company_name')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.warn('⚠️ Could not fetch company profile:', profileError);
      }

      // Get current content to restructure
      console.log('🔄 Fetching existing content for task:', contentTaskId);
      const { data: currentTask, error: taskError } = await supabase
        .from('content_tasks')
        .select('ai_output')
        .eq('id', contentTaskId)
        .single();

      if (taskError) {
        console.error('❌ Error fetching current content:', taskError);
        toast({
          title: "Error",
          description: "Failed to fetch current content",
          variant: "destructive",
        });
        return;
      }

      if (!currentTask?.ai_output) {
        console.error('❌ No existing content found to restructure');
        toast({
          title: "Error",
          description: "No existing content found to restructure",
          variant: "destructive",
        });
        return;
      }

      const businessName = profile?.company_name || 'Your Garden Center';
      console.log('🔄 Regenerating newsletter with business:', businessName);

      const { data, error } = await supabase.functions.invoke('generate-structured-newsletter', {
        body: {
          business_name: businessName,
          theme: campaignTitle || 'Newsletter Content',
          week_focus: `Restructure existing newsletter content into proper YAML format`,
          existingContent: currentTask.ai_output,
          userId: user.id,
          is_holiday: false
        }
      });
      
      if (error) {
        console.error('❌ Newsletter regeneration error:', error);
        toast({
          title: "Error",
          description: `Failed to regenerate newsletter: ${error.message || 'Unknown error'}`,
          variant: "destructive",
        });
        return;
      }
      
      // Handle both possible response structures
      const newContent = data?.yamlContent || data?.content;
      
      if (newContent) {
        console.log('✅ Generated restructured newsletter content, updating task...');

        // Update the task with new structured content
        const { error: updateError } = await supabase
          .from('content_tasks')
          .update({
            ai_output: newContent,
            status: 'review'
          })
          .eq('id', contentTaskId);
          
        if (updateError) {
          console.error('❌ Error updating newsletter:', updateError);
          toast({
            title: "Error",
            description: "Failed to save regenerated newsletter",
            variant: "destructive",
          });
        } else {
          console.log('✅ Newsletter successfully regenerated and saved');
          toast({
            title: "Success",
            description: "Newsletter restructured successfully! Refreshing page...",
          });
          setTimeout(() => window.location.reload(), 1500);
        }
      } else {
        console.error('❌ No content returned from generation function. Response:', data);
        toast({
          title: "Error",
          description: "No content was generated. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Newsletter regeneration failed:', error);
      toast({
        title: "Error",
        description: `Failed to regenerate newsletter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Button 
      onClick={regenerateNewsletter}
      disabled={regenerating}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
      {regenerating ? 'Regenerating...' : 'Regenerate Newsletter'}
    </Button>
  );
};