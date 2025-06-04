
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Instagram, Facebook, Mail, CheckCircle, BookOpen } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ContentSidebarProps {
  task: any;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate?: () => void;
}

export const ContentSidebar = ({ task, isOpen, onClose, onTaskUpdate }: ContentSidebarProps) => {
  const [editedContent, setEditedContent] = useState(task?.ai_output || "");
  const [isApproving, setIsApproving] = useState(false);

  const copyToClipboard = (text: string, platform: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `Content copied for ${platform}`,
    });
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: 'scheduled' })
        .eq('id', task.id);

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
        onClose(); // Close modal after successful approval
      }
    } catch (error) {
      console.error('Error approving task:', error);
      toast({
        title: "Error",
        description: "Failed to approve content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case "instagram": return <Instagram className="w-4 h-4" />;
      case "facebook": return <Facebook className="w-4 h-4" />;
      case "email": return <Mail className="w-4 h-4" />;
      case "newsletter": return <BookOpen className="w-4 h-4" />;
      default: return <Mail className="w-4 h-4" />;
    }
  };

  const getPlaceholderText = () => {
    if (task?.status === 'generating') {
      return "AI is currently generating content for this post...";
    } else if (task?.status === 'planned') {
      return "Content will be generated when this task moves to generating status...";
    } else {
      return `Write your ${task?.post_type} content here...`;
    }
  };

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-800">
            {getPostTypeIcon(task.post_type)}
            Content Editor - {task.post_type.charAt(0).toUpperCase() + task.post_type.slice(1)} Post
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {task.status === 'review' && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-4">
                <div className="text-center">
                  <h3 className="font-semibold text-yellow-800 mb-2">Ready for Approval</h3>
                  <p className="text-sm text-yellow-700 mb-4">
                    Review the content below and approve it to move to scheduled status.
                  </p>
                  <Button 
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {isApproving ? "Approving..." : "Approve Content"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Scheduled for:</p>
                <Badge variant="outline" className="mb-4">
                  {new Date(task.scheduled_date).toLocaleDateString()}
                </Badge>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Content
                </label>
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  placeholder={getPlaceholderText()}
                  className="min-h-[200px]"
                  disabled={task.status === 'generating'}
                />
                {task.status === 'generating' && (
                  <p className="text-xs text-blue-600 mt-1">
                    Content is being generated by AI. Please wait...
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {task.hashtags && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Hashtags
                  </label>
                  <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded border">
                    {task.hashtags}
                  </div>
                </div>
              )}

              {task.image_idea && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Image Idea
                  </label>
                  <div className="text-sm text-green-600 bg-green-50 p-3 rounded border">
                    💡 {task.image_idea}
                  </div>
                </div>
              )}

              {task.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Notes
                  </label>
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                    {task.notes}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="font-medium text-gray-800">Quick Copy Actions</h3>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => copyToClipboard(editedContent, "Instagram")}
                  disabled={!editedContent.trim()}
                >
                  <Instagram className="w-4 h-4 mr-2" />
                  Copy for Instagram
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => copyToClipboard(editedContent, "Facebook")}
                  disabled={!editedContent.trim()}
                >
                  <Facebook className="w-4 h-4 mr-2" />
                  Copy for Facebook
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => copyToClipboard(editedContent, "Email")}
                  disabled={!editedContent.trim()}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Copy for Email
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => copyToClipboard(editedContent, "Newsletter")}
                  disabled={!editedContent.trim()}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Copy for Newsletter
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button 
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={!editedContent.trim() || task.status === 'generating'}
            >
              Save Changes
            </Button>
            <Button 
              variant="outline"
              onClick={onClose}
              className="px-6"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
