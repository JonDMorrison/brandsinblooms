
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Instagram, Facebook, Mail, BookOpen, Video, FileText, Copy, Edit, Save, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { postToFacebook, postToInstagram } from "@/utils/socialMediaUtils";

interface ReadyPostModalProps {
  task: any;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate?: () => void;
}

export const ReadyPostModal = ({ task, isOpen, onClose, onTaskUpdate }: ReadyPostModalProps) => {
  const [editedContent, setEditedContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (task?.ai_output) {
      setEditedContent(stripHtmlAndFormat(task.ai_output));
    } else {
      setEditedContent("");
    }
  }, [task]);

  const stripHtmlAndFormat = (content: string) => {
    if (!content) return content;
    
    // Check if content is HTML (contains HTML tags)
    if (content.includes('<html>') || content.includes('<!DOCTYPE')) {
      // Extract content from HTML body
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        content = bodyMatch[1];
      }
      
      // Remove all HTML tags but preserve structure
      content = content
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
        .replace(/<h[1-6][^>]*>/gi, '\n\n**') // Convert headers to bold
        .replace(/<\/h[1-6]>/gi, '**\n') // Close headers
        .replace(/<p[^>]*>/gi, '\n\n') // Convert paragraphs
        .replace(/<\/p>/gi, '') // Close paragraphs
        .replace(/<br[^>]*>/gi, '\n') // Convert line breaks
        .replace(/<li[^>]*>/gi, '\n• ') // Convert list items
        .replace(/<\/li>/gi, '') // Close list items
        .replace(/<ul[^>]*>|<\/ul>/gi, '') // Remove ul tags
        .replace(/<ol[^>]*>|<\/ol>/gi, '') // Remove ol tags
        .replace(/<strong[^>]*>|<b[^>]*>/gi, '**') // Convert bold tags
        .replace(/<\/strong>|<\/b>/gi, '**') // Close bold tags
        .replace(/<em[^>]*>|<i[^>]*>/gi, '*') // Convert italic tags
        .replace(/<\/em>|<\/i>/gi, '*') // Close italic tags
        .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1') // Extract link text
        .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
        .replace(/\\n/g, '\n') // Convert literal \n to actual newlines
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Clean up multiple line breaks
        .trim();
    } else {
      // Handle content that might have literal \n characters
      content = content.replace(/\\n/g, '\n');
    }
    
    return content;
  };

  const getPostTypeIcon = (postType: string) => {
    switch (postType) {
      case 'instagram': return <Instagram className="w-5 h-5" />;
      case 'facebook': return <Facebook className="w-5 h-5" />;
      case 'email': return <Mail className="w-5 h-5" />;
      case 'newsletter': return <BookOpen className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getPostTypeColor = (postType: string) => {
    switch (postType) {
      case 'instagram': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'facebook': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'email': return 'bg-green-100 text-green-800 border-green-200';
      case 'newsletter': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'video': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(editedContent);
    toast.success(`${task.post_type} content copied to clipboard`);
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ ai_output: editedContent })
        .eq('id', task.id);

      if (error) {
        console.error('Error saving content:', error);
        toast.error('Failed to save content. Please try again.');
      } else {
        toast.success('Content saved successfully!');
        setIsEditing(false);
        if (onTaskUpdate) onTaskUpdate();
      }
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error('Failed to save content. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedContent(stripHtmlAndFormat(task.ai_output));
    setIsEditing(false);
  };

  const handleSocialMediaPost = () => {
    if (task.post_type === 'facebook') {
      postToFacebook(editedContent);
    } else if (task.post_type === 'instagram') {
      postToInstagram(editedContent);
    }
  };

  if (!task) return null;

  const showSocialMediaButton = task.post_type === 'facebook' || task.post_type === 'instagram';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getPostTypeIcon(task.post_type)}
              <DialogTitle className="capitalize">
                {task.post_type} Post
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getPostTypeColor(task.post_type)}>
                {task.post_type}
              </Badge>
              <Badge className="bg-green-100 text-green-800">
                ✅ Ready
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {task.scheduled_date && (
            <div>
              <p className="text-sm text-gray-600 mb-2">Scheduled for:</p>
              <Badge variant="outline" className="text-sm">
                {new Date(task.scheduled_date).toLocaleDateString()}
              </Badge>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Content</h3>
              {!isEditing && (
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  size="sm"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[300px] text-sm leading-relaxed"
                  placeholder={`Edit your ${task.post_type} content...`}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleCancelEdit}
                    variant="ghost"
                    size="sm"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {editedContent}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={handleCopyContent}
              variant="outline"
              className="flex-1"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Content
            </Button>
            {showSocialMediaButton ? (
              <Button
                onClick={handleSocialMediaPost}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {task.post_type === 'facebook' ? (
                  <Facebook className="w-4 h-4 mr-2" />
                ) : (
                  <Instagram className="w-4 h-4 mr-2" />
                )}
                Post to {task.post_type === 'facebook' ? 'Facebook' : 'Instagram'}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => toast.info('Post publishing integration coming soon')}
                className="flex-1"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Publish
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
