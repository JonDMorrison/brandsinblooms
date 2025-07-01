
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Play, CheckCircle, Clock, Sparkles } from "lucide-react";
import { ContentViewer } from "@/components/content/ContentViewer";
import { formatDate } from "@/utils/dateUtils";

interface Campaign {
  id: string;
  title: string;
  theme?: string;
  description?: string;
  start_date: string;
  week_number: number;
  source?: string;
}

interface Task {
  id: string;
  post_type: string;
  status: string;
  ai_output?: string;
}

interface WeekCampaignCardProps {
  campaign: Campaign;
  tasks: Task[];
  onTaskUpdate: () => void;
  onGenerateContent?: (campaignId: string) => void;
}

export const WeekCampaignCard = ({ 
  campaign, 
  tasks = [], 
  onTaskUpdate,
  onGenerateContent 
}: WeekCampaignCardProps) => {
  const [showContentViewer, setShowContentViewer] = useState(false);

  // FIXED: Use standardized content types - blog instead of email
  const expectedContentTypes = ['instagram', 'facebook', 'newsletter', 'blog', 'video'];
  const campaignTasks = tasks.filter(task => task && expectedContentTypes.includes(task.post_type));
  
  const completedTasks = campaignTasks.filter(task => 
    task.ai_output && 
    task.ai_output.trim() !== '' && 
    ['ready', 'approved', 'published', 'review'].includes(task.status)
  );

  const missingTasks = expectedContentTypes.filter(type => 
    !campaignTasks.some(task => task.post_type === type && task.ai_output?.trim())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'ready':
      case 'review':
        return 'bg-blue-100 text-blue-800';
      case 'generating':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const handleGenerateContent = () => {
    if (onGenerateContent) {
      onGenerateContent(campaign.id);
    }
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold mb-1">
                {campaign.title}
              </CardTitle>
              <CardDescription className="text-sm text-gray-600">
                {campaign.theme && (
                  <span className="block mb-1">Theme: {campaign.theme}</span>
                )}
                {campaign.description && (
                  <span className="block">{campaign.description}</span>
                )}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              Week {campaign.week_number}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(campaign.start_date)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{completedTasks.length}/{expectedContentTypes.length} content pieces</span>
            </div>
          </div>

          {campaignTasks.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Content Status:</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {expectedContentTypes.map((contentType) => {
                  const task = campaignTasks.find(t => t.post_type === contentType);
                  const hasContent = task?.ai_output && task.ai_output.trim() !== '';
                  
                  return (
                    <div
                      key={contentType}
                      className={`flex items-center gap-2 p-2 rounded-lg border ${
                        hasContent ? 'border-green-200 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      {hasContent ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-xs font-medium capitalize">
                        {contentType}
                      </span>
                      {task && (
                        <Badge 
                          className={`text-xs ${getStatusColor(task.status)}`}
                          variant="secondary"
                        >
                          {task.status}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {missingTasks.length > 0 && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="text-sm font-medium text-orange-800 mb-1">
                Missing Content:
              </div>
              <div className="text-xs text-orange-700">
                {missingTasks.join(', ')}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {missingTasks.length > 0 && onGenerateContent && (
              <Button
                onClick={handleGenerateContent}
                size="sm"
                variant="default"
                className="flex-1"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Missing Content
              </Button>
            )}
            <Button
              onClick={() => setShowContentViewer(true)}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              View Content
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
