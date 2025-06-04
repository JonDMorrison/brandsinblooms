import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { X, Copy, Instagram, Facebook, Mail, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ContentSidebarProps {
  task: any;
  onClose: () => void;
  onTaskUpdate?: () => void;
}

export const ContentSidebar = ({ task, onClose, onTaskUpdate }: ContentSidebarProps) => {
  const [editedContent, setEditedContent] = useState(task.ai_output);
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
      default: return <Mail className="w-4 h-4" />;
    }
  };

  return (
    <div className="w-96 border-l border-green-200 bg-white p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-green-800">Content Editor</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              {getPostTypeIcon(task.post_type)}
              {task.post_type.charAt(0).toUpperCase() + task.post_type.slice(1)} Post
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-2">Scheduled for:</p>
            <Badge variant="outline" className="mb-4">
              {new Date(task.scheduled_date).toLocaleDateString()}
            </Badge>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Content
                </label>
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              {task.hashtags && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Hashtags
                  </label>
                  <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                    {task.hashtags}
                  </p>
                </div>
              )}

              {task.image_idea && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Image Idea
                  </label>
                  <p className="text-sm text-green-600 bg-green-50 p-2 rounded">
                    💡 {task.image_idea}
                  </p>
                </div>
              )}

              {task.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Notes
                  </label>
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    {task.notes}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h3 className="font-medium text-gray-800">Quick Copy Actions</h3>
          
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => copyToClipboard(editedContent, "Instagram")}
          >
            <Instagram className="w-4 h-4 mr-2" />
            Copy for Instagram
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => copyToClipboard(editedContent, "Facebook")}
          >
            <Facebook className="w-4 h-4 mr-2" />
            Copy for Facebook
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => copyToClipboard(editedContent, "Email")}
          >
            <Mail className="w-4 h-4 mr-2" />
            Copy for Email
          </Button>
        </div>

        <div className="pt-4 border-t">
          <Button className="w-full bg-green-600 hover:bg-green-700">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};
