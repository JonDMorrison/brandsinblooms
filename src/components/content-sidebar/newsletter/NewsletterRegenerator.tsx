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
      console.log('🔄 Regenerating newsletter content for task:', contentTaskId);
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-structured-newsletter', {
        body: {
          business_name: 'Homestead Nurseryland',
          theme: campaignTitle || 'Roses Week',
          week_focus: campaignTitle === 'Roses Week' ? 'Expert rose care tips, pruning techniques, disease prevention, feeding schedules, and seasonal maintenance to help your roses thrive all season long' : `Expert gardening advice for ${campaignTitle || 'seasonal care'}`,
          promo_items: [],
          tone_note: 'Professional yet friendly nursery tone with expert gardening advice',
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
        console.log('✅ Generated new newsletter content, updating task...');

        // Update the task with new content
        const {
          error: updateError
        } = await supabase.from('content_tasks').update({
          ai_output: data.content,
          status: 'review'
        }).eq('id', contentTaskId);
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
            description: "Newsletter regenerated successfully! Refreshing page...",
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