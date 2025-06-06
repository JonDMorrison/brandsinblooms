
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, FileText, Edit, Copy, Instagram, Facebook, Mail, CheckCircle, BookOpen, Video, Loader } from "lucide-react";
import { getStatusColor } from './homepageUtils';
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ThemeDisplay } from "../calendar/ThemeDisplay";

interface WeekCampaignCardProps {
  currentCampaign: any;
  campaignTasks: any[];
  isGeneratingTasks: boolean;
  onTaskClick: (task: any) => void;
  onTaskUpdate?: () => void;
}

export const WeekCampaignCard = ({ 
  currentCampaign, 
  campaignTasks, 
  isGeneratingTasks, 
  onTaskClick, 
  onTaskUpdate
}: WeekCampaignCardProps) => {
  const [approvingTasks, setApprovingTasks] = useState<Set<string>>(new Set());

  const handleApprove = async (taskId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    setApprovingTasks(prev => new Set(prev).add(taskId));
    
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'scheduled' })
        .eq('id', taskId);

      if (error) {
        console.error('Error approving task:', error);
        toast({
          title: "Error",
          description: "Failed to approve content. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Content Approved! ✅",
          description: "Content has been moved to scheduled status.",
        });
        if (onTaskUpdate) onTaskUpdate();
      }
    } catch (error) {
      console.error('Error approving task:', error);
      toast({
        title: "Error",
        description: "Failed to approve content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setApprovingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };
  
  const getPostTypeIcon = (postType: string) => {
    switch (postType) {
      case 'instagram': return <Instagram className="w-4 h-4" />;
      case 'facebook': return <Facebook className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'newsletter': return <BookOpen className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getPostTypeColor = (postType: string) => {
    switch (postType) {
      case 'instagram': return 'from-pink-50 to-purple-50 border-pink-200';
      case 'facebook': return 'from-blue-50 to-indigo-50 border-blue-200';
      case 'email': return 'from-green-50 to-emerald-50 border-green-200';
      case 'newsletter': return 'from-purple-50 to-indigo-50 border-purple-200';
      case 'video': return 'from-red-50 to-orange-50 border-red-200';
      default: return 'from-gray-50 to-slate-50 border-gray-200';
    }
  };

  const getPostTypeLabel = (postType: string) => {
    switch (postType) {
      case 'instagram': return 'Instagram Post';
      case 'facebook': return 'Facebook Post';
      case 'email': return 'Email Theme';
      case 'newsletter': return 'Weekly Newsletter';
      case 'video': return 'Video Script';
      default: return postType;
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

  const getCurrentWeekNumber = () => {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  // Define the required content types in order
  const requiredTypes = ['newsletter', 'instagram', 'facebook', 'email', 'video'];
  
  // Organize tasks by type
  const tasksByType = campaignTasks.reduce((acc: any, task: any) => {
    acc[task.post_type] = task;
    return acc;
  }, {});

  return (
    <Card className="shadow-xl border-green-200 rounded-xl overflow-hidden campaign-card-active">
      <CardHeader className="bg-gradient-to-r from-primary to-primary-600 text-white">
        <CardTitle className="text-2xl font-bold flex items-center gap-3">
          <Calendar className="w-6 h-6" />
          This Week's Theme
        </CardTitle>
        <CardDescription className="text-green-100 font-medium">
          {currentCampaign ? currentCampaign.title : "No active theme"}
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

            {/* Content Theme Section */}
            {(currentCampaign.theme || currentCampaign.description) && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <ThemeDisplay
                  currentTheme={currentCampaign.theme || currentCampaign.title}
                  currentDescription={currentCampaign.description}
                  onEdit={() => {
                    // For now, just log - this could be enhanced to allow editing
                    console.log('Edit theme clicked');
                  }}
                />
              </div>
            )}
            
            {/* Required Content Types */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                Required Weekly Content ({campaignTasks.length}/5)
              </h3>
              
              {requiredTypes.map((type) => {
                const task = tasksByType[type];
                const hasTask = !!task;
                const hasContent = task?.ai_output && task.ai_output.trim() !== '';
                
                return (
                  <div 
                    key={type} 
                    className={`border rounded-xl p-5 transition-all duration-200 cursor-pointer ${
                      hasTask 
                        ? `bg-gradient-to-r ${getPostTypeColor(type)} hover:shadow-md ${hasContent ? 'hover:bg-opacity-80' : ''}`
                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => hasTask && onTaskClick(task)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getPostTypeIcon(type)}
                        <span className="font-semibold text-gray-800">{getPostTypeLabel(type)}</span>
                        {hasTask && (
                          <Badge className={`${getStatusColor(task.status)} font-medium`}>
                            {task.status}
                          </Badge>
                        )}
                        {hasContent && (
                          <Badge className="bg-blue-100 text-blue-800 font-medium">
                            ✨ Ready
                          </Badge>
                        )}
                      </div>
                      
                      {hasTask && hasContent && (
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={(e) => handleApprove(String(task.id), e)}
                            disabled={approvingTasks.has(String(task.id))}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {approvingTasks.has(String(task.id)) ? "Approving..." : "Approve"}
                          </Button>
                          <Button size="sm" variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-100">
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-100">
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="mb-3">
                      {hasTask ? (
                        hasContent ? (
                          <div 
                            className="text-sm text-gray-700 line-clamp-3 font-medium leading-relaxed prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: task.ai_output }}
                          />
                        ) : (
                          <div className="flex items-center justify-center gap-3 py-4">
                            <Loader className="w-5 h-5 animate-spin text-blue-600" />
                            <p className="text-sm text-blue-600 font-medium">Generating {getPostTypeLabel(type).toLowerCase()}...</p>
                          </div>
                        )
                      ) : isGeneratingTasks ? (
                        <div className="flex items-center justify-center gap-3 py-4">
                          <Loader className="w-5 h-5 animate-spin text-gray-500" />
                          <p className="text-sm text-gray-500 font-medium">Creating {getPostTypeLabel(type).toLowerCase()}...</p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">
                          {getPostTypeLabel(type)} will be created automatically
                        </p>
                      )}
                    </div>
                    
                    {hasTask && task.scheduled_date && (
                      <p className="text-xs text-gray-500 mt-3 font-medium">
                        Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {isGeneratingTasks && (
              <div className="text-center py-6 text-gray-500">
                <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="font-medium">Setting up your weekly content...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-40" />
            <p className="font-medium mb-4">No active themes found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
