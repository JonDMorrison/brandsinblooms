
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Instagram, Facebook, Mail, Video, BookOpen, Eye, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { generatePersonalizedContent, generateNewsletterContent, generateVideoScript } from "@/components/homepage/ContentGenerationServices";
import { ContentViewer } from "@/components/content/ContentViewer";
import type { Campaign } from "@/types";

interface ContentPreviewSectionProps {
  campaign: Campaign;
  onTaskUpdate: () => void;
}

interface ContentPreview {
  type: string;
  content: string;
  icon: any;
  label: string;
  color: string;
}

export const ContentPreviewSection = ({ campaign, onTaskUpdate }: ContentPreviewSectionProps) => {
  const { user } = useAuth();
  const [contentPreviews, setContentPreviews] = useState<ContentPreview[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showContentViewer, setShowContentViewer] = useState(false);
  const [hasGeneratedContent, setHasGeneratedContent] = useState(false);

  useEffect(() => {
    checkAndGenerateContent();
  }, [campaign.id]);

  const checkAndGenerateContent = async () => {
    if (!campaign.id || !user) return;

    try {
      // Check if content already exists
      const { data: existingTasks, error } = await supabase
        .from('content_tasks')
        .select('*')
        .eq('campaign_id', campaign.id);

      if (error) {
        console.error('Error checking existing content:', error);
        return;
      }

      const tasksWithContent = existingTasks?.filter(task => task.ai_output && task.ai_output.trim() !== '') || [];
      
      if (tasksWithContent.length > 0) {
        // Display existing content
        displayContentPreviews(tasksWithContent);
        setHasGeneratedContent(true);
      } else {
        // Generate new content immediately
        await generateContentPreviews();
      }
    } catch (error) {
      console.error('Error in checkAndGenerateContent:', error);
    }
  };

  const generateContentPreviews = async () => {
    if (!user || isGenerating) return;

    setIsGenerating(true);
    const previews: ContentPreview[] = [];

    try {
      // Generate Instagram post
      const instagramContent = await generatePersonalizedContent('instagram', campaign.title, user.id, campaign.description);
      previews.push({
        type: 'instagram',
        content: instagramContent.substring(0, 150) + '...',
        icon: Instagram,
        label: 'Instagram Post',
        color: 'text-pink-600'
      });

      // Generate Facebook post
      const facebookContent = await generatePersonalizedContent('facebook', campaign.title, user.id, campaign.description);
      previews.push({
        type: 'facebook',
        content: facebookContent.substring(0, 150) + '...',
        icon: Facebook,
        label: 'Facebook Post',
        color: 'text-blue-600'
      });

      // Generate newsletter snippet
      const newsletterContent = await generateNewsletterContent(campaign.id, campaign.title, campaign.week_number, user.id, campaign.description);
      previews.push({
        type: 'newsletter',
        content: newsletterContent.substring(0, 150) + '...',
        icon: BookOpen,
        label: 'Newsletter',
        color: 'text-purple-600'
      });

      setContentPreviews(previews);
      setHasGeneratedContent(true);
      onTaskUpdate();
    } catch (error) {
      console.error('Error generating content previews:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const displayContentPreviews = (tasks: any[]) => {
    const previews: ContentPreview[] = [];
    
    tasks.slice(0, 3).forEach(task => {
      let icon, label, color;
      
      switch (task.post_type) {
        case 'instagram':
          icon = Instagram;
          label = 'Instagram Post';
          color = 'text-pink-600';
          break;
        case 'facebook':
          icon = Facebook;
          label = 'Facebook Post';
          color = 'text-blue-600';
          break;
        case 'newsletter':
          icon = BookOpen;
          label = 'Newsletter';
          color = 'text-purple-600';
          break;
        case 'email':
          icon = Mail;
          label = 'Email';
          color = 'text-green-600';
          break;
        case 'video':
          icon = Video;
          label = 'Video Script';
          color = 'text-red-600';
          break;
        default:
          icon = Sparkles;
          label = 'Content';
          color = 'text-gray-600';
      }

      previews.push({
        type: task.post_type,
        content: task.ai_output?.substring(0, 150) + '...' || 'Content generated',
        icon,
        label,
        color
      });
    });

    setContentPreviews(previews);
  };

  if (isGenerating) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-3 py-8">
            <LoadingSpinner size="sm" />
            <div>
              <p className="font-medium text-gray-800">Generating your AI content...</p>
              <p className="text-sm text-gray-600">Creating personalized posts and content</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasGeneratedContent) {
    return (
      <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
        <CardContent className="p-6">
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No content generated yet</p>
            <Button onClick={generateContentPreviews} className="bg-primary hover:bg-primary/90">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate AI Content
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI-Generated Content Preview
            </CardTitle>
            <Badge className="bg-green-100 text-green-800 border-green-200">
              ✨ Ready
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {contentPreviews.map((preview, index) => {
            const IconComponent = preview.icon;
            return (
              <div key={index} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <IconComponent className={`w-5 h-5 ${preview.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 mb-1">{preview.label}</h4>
                    <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
                      {preview.content}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          
          <div className="pt-4 border-t border-gray-200">
            <Button 
              onClick={() => setShowContentViewer(true)}
              className="w-full bg-primary hover:bg-primary/90"
            >
              <Eye className="w-4 h-4 mr-2" />
              View All Generated Content
            </Button>
          </div>
        </CardContent>
      </Card>

      <ContentViewer
        campaignId={campaign.id}
        campaignTitle={campaign.title}
        isOpen={showContentViewer}
        onClose={() => setShowContentViewer(false)}
        onTaskUpdate={onTaskUpdate}
      />
    </>
  );
};
