import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, CheckCircle, Edit, ExternalLink, Instagram, Facebook, Mail, BookOpen, Video, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { postToFacebook, postToInstagram } from "@/utils/socialMediaUtils";
import { stripHtmlAndFormat } from "@/components/homepage/ready-to-post/contentUtils";
import { CampaignContentGenerator } from "./CampaignContentGenerator";

interface ContentViewerProps {
  campaignId: string;
  campaignTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate?: () => void;
}

export const ContentViewer = ({ campaignId, campaignTitle, isOpen, onClose, onTaskUpdate }: ContentViewerProps) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [approvingTasks, setApprovingTasks] = useState<Set<string>>(new Set());

  const fetchTasks = async () => {
    if (!campaignId || !isOpen) {
      console.log('ContentViewer: Skipping fetch - campaignId:', campaignId, 'isOpen:', isOpen);
      return;
    }
    
    console.log('ContentViewer: Starting fetch for campaignId:', campaignId);
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('content_tasks')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true });

      console.log('ContentViewer: Fetch result - data:', data, 'error:', error);

      if (error) {
        console.error('ContentViewer: Error fetching tasks:', error);
        toast.error('Failed to load content');
      } else {
        console.log('ContentViewer: Successfully fetched', data?.length || 0, 'tasks');
        setTasks(data || []);
      }
    } catch (error) {
      console.error('ContentViewer: Exception in fetchTasks:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('ContentViewer: useEffect triggered - campaignId:', campaignId, 'isOpen:', isOpen);
    fetchTasks();
  }, [campaignId, isOpen]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'generating': return 'bg-purple-100 text-purple-800';
      case 'published': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleApprove = async (taskId: string) => {
    setApprovingTasks(prev => new Set(prev).add(taskId));
    
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'completed' })
        .eq('id', taskId);

      if (error) {
        console.error('Error approving task:', error);
        toast.error('Failed to approve content');
      } else {
        toast.success('Content approved and moved to Ready to Post!');
        fetchTasks();
        if (onTaskUpdate) onTaskUpdate();
      }
    } catch (error) {
      console.error('Error approving task:', error);
      toast.error('Failed to approve content');
    } finally {
      setApprovingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const handleCopy = (content: string) => {
    if (!content) return;
    
    // Strip HTML and format for copying
    const cleanContent = content
      .replace(/<[^>]*>/g, '')
      .replace(/\\n/g, '\n')
      .trim();
    
    navigator.clipboard.writeText(cleanContent);
    toast.success('Content copied to clipboard');
  };

  const handleSocialMediaPost = (task: any) => {
    const cleanContent = task.ai_output
      .replace(/<[^>]*>/g, '')
      .replace(/\\n/g, '\n')
      .trim();

    if (task.post_type === 'facebook') {
      postToFacebook(cleanContent);
    } else if (task.post_type === 'instagram') {
      postToInstagram(cleanContent);
    }
  };

  console.log('ContentViewer: Rendering with', tasks.length, 'tasks, loading:', loading);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {campaignTitle} - Generated Content
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[600px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading content...</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-gray-500 mb-4">No content generated yet for this campaign</p>
              <CampaignContentGenerator
                campaignId={campaignId}
                campaignTitle={campaignTitle}
                onContentGenerated={fetchTasks}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-gray-600">
                  Found {tasks.length} tasks for this campaign
                </div>
                <CampaignContentGenerator
                  campaignId={campaignId}
                  campaignTitle={campaignTitle}
                  onContentGenerated={fetchTasks}
                />
              </div>

              {tasks.map((task) => {
                const showSocialMediaButton = (task.post_type === 'facebook' || task.post_type === 'instagram') && task.status === 'completed';
                const canApprove = task.status === 'draft' && task.ai_output;
                const canEdit = task.ai_output && task.status !== 'published';
                
                return (
                  <div key={task.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getPostTypeIcon(task.post_type)}
                        <span className="font-medium capitalize">{task.post_type}</span>
                        <Badge className={getStatusColor(task.status)}>
                          {task.status}
                        </Badge>
                      </div>
                      
                      <TooltipProvider>
                        <div className="flex gap-2">
                          {task.ai_output && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopy(task.ai_output)}
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copy
                            </Button>
                          )}
                          
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toast.info('Edit functionality would open content editor')}
                              className="border-blue-300 text-blue-600 hover:bg-blue-50"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          )}
                          
                          {canApprove && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => handleApprove(task.id)}
                                  disabled={approvingTasks.has(task.id)}
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  {approvingTasks.has(task.id) ? 'Approving...' : 'Approve'}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Approve this content and send it to the Ready to Post section</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          
                          {showSocialMediaButton ? (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => handleSocialMediaPost(task)}
                            >
                              {task.post_type === 'facebook' ? (
                                <>
                                  <Facebook className="w-3 h-3 mr-1" />
                                  Post to Facebook
                                </>
                              ) : (
                                <>
                                  <Instagram className="w-3 h-3 mr-1" />
                                  Post to Instagram
                                </>
                              )}
                            </Button>
                          ) : task.status === 'completed' && task.post_type !== 'facebook' && task.post_type !== 'instagram' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toast.info('Publishing integration coming soon')}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Publish
                            </Button>
                          ) : null}
                        </div>
                      </TooltipProvider>
                    </div>

                    {task.ai_output && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {stripHtmlAndFormat(task.ai_output)}
                        </div>
                      </div>
                    )}

                    {task.scheduled_date && (
                      <p className="text-xs text-gray-500">
                        Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
