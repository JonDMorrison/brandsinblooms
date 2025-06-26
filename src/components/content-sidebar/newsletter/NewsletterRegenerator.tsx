
import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

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

  const regenerateNewsletter = async () => {
    if (!user || !contentTaskId) {
      toast.error('Unable to regenerate newsletter - missing required information');
      return;
    }

    setRegenerating(true);
    try {
      console.log('🔄 Regenerating newsletter content for task:', contentTaskId);
      
      const { data, error } = await supabase.functions.invoke('generate-structured-newsletter', {
        body: {
          business_name: '',
          theme: campaignTitle || 'Seasonal Gardening',
          week_focus: `Expert gardening advice for ${campaignTitle || 'seasonal care'}`,
          promo_items: [],
          tone_note: '',
          userId: user.id,
          is_holiday: false
        }
      });

      if (error) {
        console.error('❌ Newsletter regeneration error:', error);
        toast.error('Failed to regenerate newsletter content');
        return;
      }

      if (data?.content) {
        console.log('✅ Generated new newsletter content, updating task...');
        
        // Update the task with new content
        const { error: updateError } = await supabase
          .from('content_tasks')
          .update({
            ai_output: data.content,
            status: 'review'
          })
          .eq('id', contentTaskId);

        if (updateError) {
          console.error('❌ Error updating newsletter:', updateError);
          toast.error('Failed to save regenerated newsletter');
        } else {
          toast.success('Newsletter regenerated successfully! Refreshing page...');
          setTimeout(() => window.location.reload(), 1500);
        }
      } else {
        console.error('❌ No content returned from generation function');
        toast.error('No content was generated');
      }
    } catch (error) {
      console.error('❌ Newsletter regeneration failed:', error);
      toast.error('Failed to regenerate newsletter');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <h2 className="text-xl font-semibold text-gray-700 mb-4">
        Newsletter Content Needs Generation
      </h2>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        The newsletter content appears to be incomplete or just a placeholder. 
        Let's generate proper structured newsletter content with expert gardening advice.
      </p>
      <Button 
        onClick={regenerateNewsletter}
        disabled={regenerating || !contentTaskId}
        className="gap-2"
      >
        <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
        {regenerating ? 'Generating Newsletter...' : 'Generate Full Newsletter'}
      </Button>
      {!contentTaskId && (
        <p className="text-sm text-gray-500 mt-2">
          Content ID required for regeneration
        </p>
      )}
    </div>
  );
};
