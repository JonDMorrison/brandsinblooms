import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Plus, FileText, Edit, Copy, Instagram, Facebook, Mail } from "lucide-react";
import { getStatusColor, getCurrentWeekNumber } from './homepageUtils';

interface WeekCampaignCardProps {
  currentCampaign: any;
  campaignTasks: any[];
  isGeneratingTasks: boolean;
  onTaskClick: (task: any) => void;
  onGenerateTasks: (campaignId: string) => void;
}

export const WeekCampaignCard = ({ 
  currentCampaign, 
  campaignTasks, 
  isGeneratingTasks, 
  onTaskClick, 
  onGenerateTasks 
}: WeekCampaignCardProps) => {
  
  const getPostTypeIcon = (postType: string) => {
    switch (postType) {
      case 'instagram': return <Instagram className="w-4 h-4" />;
      case 'facebook': return <Facebook className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getCurrentDateFormatted = () => {
    const today = new Date();
    return today.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <Card className="shadow-xl border-green-200 rounded-xl overflow-hidden campaign-card-active">
      <CardHeader className="bg-gradient-to-r from-primary to-primary-600 text-white">
        <CardTitle className="text-2xl font-bold flex items-center gap-3">
          <Calendar className="w-6 h-6" />
          This Week's Campaign
        </CardTitle>
        <CardDescription className="text-green-100 font-medium">
          {currentCampaign ? currentCampaign.title : "No active campaign"}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {currentCampaign ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4 text-sm text-gray-600 font-medium">
              <span className="flex items-center gap-2 bg-green-100 px-3 py-1 rounded-full">
                <Calendar className="w-4 h-4" />
                Week {getCurrentWeekNumber()}
              </span>
              <span className="flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-full">
                <Clock className="w-4 h-4" />
                {getCurrentDateFormatted()}
              </span>
            </div>
            
            {campaignTasks.length > 0 ? (
              <div className="space-y-4">
                {campaignTasks.map((task) => (
                  <div key={task.id} className="border border-green-200 rounded-xl p-5 hover:bg-green-50 cursor-pointer transition-all duration-200 hover:shadow-md" onClick={() => onTaskClick(task)}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getPostTypeIcon(task.post_type)}
                        <span className="font-semibold capitalize text-black">{task.post_type}</span>
                        <Badge className={`${getStatusColor(task.status)} font-medium`}>
                          {task.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="border-green-300 text-black hover:bg-green-100">
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-100">
                          <Copy className="w-3 h-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                    </div>
                    {task.ai_output && (
                      <p className="text-sm text-gray-700 line-clamp-2 font-medium leading-relaxed">{task.ai_output}</p>
                    )}
                    {task.scheduled_date && (
                      <p className="text-xs text-gray-500 mt-3 font-medium">
                        Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-40" />
                <p className="font-medium mb-4">No content tasks for this campaign yet</p>
                <Button 
                  className="bg-primary hover:bg-primary-600 text-white shadow-md"
                  onClick={() => onGenerateTasks(currentCampaign.id)}
                  disabled={isGeneratingTasks}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isGeneratingTasks ? "Generating Tasks..." : "Create Content Tasks"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-40" />
            <p className="font-medium mb-4">No active campaigns found</p>
            <Button className="bg-primary hover:bg-primary-600 text-white shadow-md">
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
