
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, MoreVertical, Play, CheckCircle, Clock } from "lucide-react";
import { ContentViewer } from "@/components/content/ContentViewer";
import { formatDate } from "@/utils/dateUtils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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

interface CampaignCardProps {
  campaign: Campaign;
  tasks: Task[];
  onTaskUpdate: () => void;
  onCampaignDelete?: (campaignId: string) => void;
  onTaskClick?: (task: Task) => void;
}

export const CampaignCard = ({ 
  campaign, 
  tasks = [], 
  onTaskUpdate, 
  onCampaignDelete,
  onTaskClick 
}: CampaignCardProps) => {
  const [showContentViewer, setShowContentViewer] = useState(false);

  // FIXED: Use standardized content types - blog instead of email
  const expectedContentTypes = ['instagram', 'facebook', 'newsletter', 'blog', 'video'];
  const campaignTasks = tasks.filter(task => task && expectedContentTypes.includes(task.post_type));
  
  const completedTasks = campaignTasks.filter(task => 
    task.ai_output && 
    task.ai_output.trim() !== '' && 
    ['ready', 'approved', 'published', 'review'].includes(task.status)
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

  const handleTaskClick = (task: Task) => {
    if (onTaskClick) {
      onTaskClick(task);
    }
  };

  const handleCampaignDelete = () => {
    if (onCampaignDelete) {
      onCampaignDelete(campaign.id);
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
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Week {campaign.week_number}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowContentViewer(true)}>
                    <Play className="mr-2 h-4 w-4" />
                    View Content
                  </DropdownMenuItem>
                  {onCampaignDelete && (
                    <DropdownMenuItem 
                      onClick={handleCampaignDelete}
                      className="text-red-600"
                    >
                      Delete Campaign
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors ${
                        hasContent ? 'border-green-200 bg-green-50' : 'border-gray-200'
                      }`}
                      onClick={() => task && handleTaskClick(task)}
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

          <div className="flex gap-2 pt-2">
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
