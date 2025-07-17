
import { useState, useEffect } from "react";
import { AppleCard, AppleCardContent, AppleCardHeader } from "@/components/ui/apple-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HeadlineLarge, BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { Eye, Sparkles, Leaf, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ContentViewer } from "@/components/content/ContentViewer";
import { ReviewQueue } from "@/components/content/ReviewQueue";

interface ContentPreviewSectionProps {
  campaign: any;
  onTaskUpdate: () => void;
}

export const ContentPreviewSection = ({ campaign, onTaskUpdate }: ContentPreviewSectionProps) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContentViewer, setShowContentViewer] = useState(false);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!campaign?.id) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('content_tasks')
          .select('*')
          .eq('campaign_id', campaign.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching tasks:', error);
        } else {
          setTasks(data || []);
        }
      } catch (error) {
        console.error('Error in fetchTasks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [campaign?.id]);

  const readyTasks = tasks.filter(task => task.status === 'review' && task.ai_output);
  const completedTasks = tasks.filter(task => task.status === 'published');

  if (loading) {
    return (
      <AppleCard variant="default" surface="primary">
        <AppleCardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <BodyMedium className="text-text-secondary ml-3">
            Loading your content...
          </BodyMedium>
        </AppleCardContent>
      </AppleCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Content Ready Section */}
      {readyTasks.length > 0 && (
        <AppleCard variant="elevated" surface="primary" className="border-l-4 border-l-primary">
          <AppleCardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-xl">
                  <Leaf className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <HeadlineLarge className="text-text-primary flex items-center gap-2">
                    Content Ready for Review
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      {readyTasks.length}
                    </Badge>
                  </HeadlineLarge>
                  <CaptionMedium className="text-text-secondary mt-1">
                    Professional marketing content tailored for your garden center
                  </CaptionMedium>
                </div>
              </div>
              <Button 
                variant="default"
                size="sm"
                onClick={() => setShowContentViewer(true)}
              >
                <Eye className="w-4 h-4 mr-2" />
                Review Content
              </Button>
            </div>
          </AppleCardHeader>
          
          <AppleCardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {readyTasks.map((task) => (
                <div key={task.id} className="bg-surface-secondary rounded-lg p-3 border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <CaptionMedium className="font-medium capitalize text-text-primary">
                      {task.post_type}
                    </CaptionMedium>
                  </div>
                  <CaptionMedium className="text-text-tertiary">Ready for review</CaptionMedium>
                </div>
              ))}
            </div>
            
            <div className="bg-surface-secondary rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <CaptionMedium className="font-medium text-text-primary">What's included:</CaptionMedium>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <CaptionMedium className="text-text-secondary">• Seasonal gardening tips and plant care advice</CaptionMedium>
                <CaptionMedium className="text-text-secondary">• Product promotions tailored for garden centers</CaptionMedium>
                <CaptionMedium className="text-text-secondary">• Engaging content for your gardening community</CaptionMedium>
                <CaptionMedium className="text-text-secondary">• Professional copy ready to post across all platforms</CaptionMedium>
              </div>
            </div>
          </AppleCardContent>
        </AppleCard>
      )}

      {/* Review Queue for Ready Content */}
      {readyTasks.length > 0 && (
        <ReviewQueue 
          onTaskUpdate={onTaskUpdate}
          onTaskClick={(task) => {
            setShowContentViewer(true);
          }}
        />
      )}

      {/* Completed Content Summary */}
      {completedTasks.length > 0 && (
        <AppleCard variant="default" surface="secondary">
          <AppleCardHeader className="pb-3">
            <HeadlineLarge className="text-text-primary flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success" />
              Posted Content
              <Badge variant="secondary">{completedTasks.length}</Badge>
            </HeadlineLarge>
          </AppleCardHeader>
          <AppleCardContent>
            <BodyMedium className="text-text-secondary">
              You've successfully posted {completedTasks.length} pieces of content from this campaign.
            </BodyMedium>
          </AppleCardContent>
        </AppleCard>
      )}

      {/* Content Viewer Modal */}
      <ContentViewer
        campaignId={campaign.id}
        campaignTitle={campaign.title}
        isOpen={showContentViewer}
        onClose={() => setShowContentViewer(false)}
        onTaskUpdate={onTaskUpdate}
      />
    </div>
  );
};
