import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, FileText, Edit, Copy, Instagram, Facebook, Mail, CheckCircle, BookOpen } from "lucide-react";
import { getStatusColor } from './homepageUtils';
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
    event.stopPropagation(); // Prevent task click from firing
    
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

  const getCurrentWeekNumber = () => {
    const today = new Date();
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  // Separate newsletter tasks from other tasks
  const newsletterTasks = campaignTasks.filter(task => task.post_type === 'newsletter');
  const otherTasks = campaignTasks.filter(task => task.post_type !== 'newsletter');

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
            
            {/* Newsletter Section - Always show */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-600" />
                AI-Generated Weekly Newsletter
              </h3>
              {newsletterTasks.length > 0 ? (
                newsletterTasks.map((task) => {
                  const taskIdString = String(task.id);
                  const hasAIContent = task.ai_output && task.ai_output.trim() !== '';
                  
                  return (
                    <div key={task.id} className="border border-purple-200 rounded-xl p-5 hover:bg-purple-50 cursor-pointer transition-all duration-200 hover:shadow-md bg-gradient-to-r from-purple-50 to-indigo-50" onClick={() => onTaskClick(task)}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <BookOpen className="w-5 h-5 text-purple-600" />
                          <span className="font-semibold text-purple-800">AI Newsletter</span>
                          <Badge className={`${getStatusColor(task.status)} font-medium`}>
                            {task.status}
                          </Badge>
                          {hasAIContent && (
                            <Badge className="bg-blue-100 text-blue-800 font-medium">
                              ✨ AI Generated
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {task.status === 'review' && hasAIContent && (
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={(e) => handleApprove(taskIdString, e)}
                              disabled={approvingTasks.has(taskIdString)}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {approvingTasks.has(taskIdString) ? "Approving..." : "Approve"}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-100">
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-100">
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        {hasAIContent ? (
                          <div>
                            <p className="text-sm text-gray-700 line-clamp-3 font-medium leading-relaxed">{task.ai_output}</p>
                            <p className="text-xs text-purple-600 mt-2 italic">✨ Generated by AI based on this week's content</p>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                              <p className="text-sm text-purple-600 font-medium">AI is writing your newsletter...</p>
                            </div>
                            <p className="text-sm text-gray-500 italic">Based on your social media and email content</p>
                          </div>
                        )}
                      </div>
                      
                      {task.scheduled_date && (
                        <p className="text-xs text-purple-600 mt-3 font-medium">
                          Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : isGeneratingTasks ? (
                <div className="border border-purple-200 rounded-xl p-5 bg-gradient-to-r from-purple-50 to-indigo-50">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                    <span className="font-semibold text-purple-800">Creating AI Newsletter...</span>
                  </div>
                  <p className="text-sm text-gray-500 italic">Your weekly newsletter will be generated by AI once content is ready...</p>
                </div>
              ) : (
                <div className="border border-purple-200 rounded-xl p-5 bg-gradient-to-r from-purple-50 to-indigo-50">
                  <div className="flex items-center gap-3 mb-3">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-purple-800">AI Newsletter Ready</span>
                  </div>
                  <p className="text-sm text-gray-500 italic">Newsletter will be generated automatically by AI...</p>
                </div>
              )}
            </div>

            {/* Other Content Tasks */}
            {otherTasks.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  Social Media & Email Content
                </h3>
                {otherTasks.map((task) => {
                  const taskIdString = String(task.id);
                  console.log('Task data:', task); // Debug log to see what's in the task
                  return (
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
                          {task.status === 'review' && (
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={(e) => handleApprove(taskIdString, e)}
                              disabled={approvingTasks.has(taskIdString)}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {approvingTasks.has(taskIdString) ? "Approving..." : "Approve"}
                            </Button>
                          )}
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
                      
                      {/* Always show content area - either generated content or placeholder */}
                      <div className="mb-3">
                        {task.ai_output ? (
                          <p className="text-sm text-gray-700 line-clamp-2 font-medium leading-relaxed">{task.ai_output}</p>
                        ) : (
                          <p className="text-sm text-gray-500 italic">Content will be generated automatically...</p>
                        )}
                      </div>
                      
                      {task.scheduled_date && (
                        <p className="text-xs text-gray-500 mt-3 font-medium">
                          Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : !newsletterTasks.length && isGeneratingTasks ? (
              <div className="text-center py-12 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="font-medium">Generating your content automatically...</p>
              </div>
            ) : !newsletterTasks.length && (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-40" />
                <p className="font-medium mb-4">Content will be generated automatically</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-40" />
            <p className="font-medium mb-4">No active campaigns found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
