
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const completedTasks = tasks.filter(task => task.status === 'posted');

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
            <span className="ml-2 text-green-700">Loading your garden center content...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Garden Center Content Ready Section */}
      {readyTasks.length > 0 && (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
                  <Leaf className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-green-800 flex items-center gap-2">
                    🌱 Garden Center Content Ready!
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      {readyTasks.length} pieces
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-green-700 mt-1">
                    Professional marketing content tailored for your garden center
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => setShowContentViewer(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Eye className="w-4 h-4 mr-2" />
                Review Content
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              {readyTasks.map((task) => (
                <div key={task.id} className="bg-white rounded-lg p-3 border border-green-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium capitalize text-gray-800">
                      {task.post_type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">Ready for review</p>
                </div>
              ))}
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">What's included:</span>
              </div>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Seasonal gardening tips and plant care advice</li>
                <li>• Product promotions tailored for garden centers</li>
                <li>• Engaging content for your gardening community</li>
                <li>• Professional copy ready to post across all platforms</li>
              </ul>
            </div>
          </CardContent>
        </Card>
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
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Posted Content
              <Badge variant="secondary">{completedTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              You've successfully posted {completedTasks.length} pieces of content from this campaign.
            </p>
          </CardContent>
        </Card>
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
