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
      toast({
        title: "Error",
        description: "Unable to regenerate newsletter - missing required information",
        variant: "destructive",
      });
      return;
    }
    setRegenerating(true);
    try {
      console.log('🔄 Fetching existing content for task:', contentTaskId);
      
      // Get current content to restructure
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

      console.log('🔄 Regenerating newsletter with existing content restructuring...');
      const { data, error } = await supabase.functions.invoke('generate-structured-newsletter', {
        body: {
          business_name: 'Homestead Nurseryland',
          theme: campaignTitle || 'Fall Transition Planning',
          week_focus: `Restructure existing newsletter content into proper YAML format`,
          existingContent: currentTask?.ai_output || '',
          userId: user.id,
          is_holiday: false
        }
      });
      
      if (error) {
        console.error('❌ Newsletter regeneration error:', error);
        toast({
          title: "Error",
          description: "Failed to regenerate newsletter content",
          variant: "destructive",
        });
        return;
      }
      
      if (data?.content) {
        console.log('✅ Generated restructured newsletter content, updating task...');

        // Update the task with new structured content
        const { error: updateError } = await supabase
          .from('content_tasks')
          .update({
            ai_output: data.content,
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
          toast({
            title: "Success",
            description: "Newsletter restructured successfully! Refreshing page...",
          });
          setTimeout(() => window.location.reload(), 1500);
        }
      } else {
        console.error('❌ No content returned from generation function');
        toast({
          title: "Error",
          description: "No content was generated",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Newsletter regeneration failed:', error);
      toast({
        title: "Error",
        description: "Failed to regenerate newsletter",
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