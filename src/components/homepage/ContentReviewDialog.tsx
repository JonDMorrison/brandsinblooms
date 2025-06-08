import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, Clock, AlertCircle, Edit, Copy } from "lucide-react";
import { toast } from "sonner";

interface ContentReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Task {
  id: string;
  status: string;
  post_type: string;
  ai_output: string;
  scheduled_date: string;
  campaign_id: string;
}

export const ContentReviewDialog = ({ open, onOpenChange }: ContentReviewDialogProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchTasks();
    }
  }, [open]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_tasks')
        .select('*')
        .in('status', ['draft', 'review'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tasks:', error);
        toast.error('Failed to load tasks');
      } else {
        setTasks(data || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      console.log('Updating task status to:', newStatus);
      
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) {
        console.error('Error updating task:', error);
        toast.error(`Failed to update task: ${error.message}`);
      } else {
        toast.success(`Task ${newStatus === 'scheduled' ? 'approved' : 'updated'}`);
        fetchTasks(); // Refresh the list
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const handleCopyContent = (content: string, postType: string) => {
    const cleanContent = stripHtmlAndFormat(content);
    navigator.clipboard.writeText(cleanContent);
    toast.success(`${postType} content copied to clipboard`);
  };

  const handleEditContent = (taskId: string) => {
    // This would typically open a content editor modal or navigate to an edit page
    // For now, we'll show a toast indicating the action
    toast.info('Edit functionality would open content editor');
    console.log('Edit task:', taskId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'review':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-green-100 text-green-800';
      case 'review':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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

  const formatContent = (content: string, postType: string) => {
    // First strip HTML if present
    const cleanContent = stripHtmlAndFormat(content);
    
    if (!cleanContent) return cleanContent;
    
    // Split content into paragraphs and format
    const paragraphs = cleanContent.split('\n\n');
    
    return paragraphs.map((paragraph, index) => {
      if (!paragraph.trim()) return null;
      
      // Handle markdown-style headers (lines with **)
      if (paragraph.includes('**')) {
        const parts = paragraph.split(/(\*\*[^*]+\*\*)/g);
        return (
          <div key={index} className="mb-4">
            {parts.map((part, partIndex) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <h4 key={partIndex} className="font-semibold text-garden-green-dark mb-2">
                    {part.replace(/\*\*/g, '')}
                  </h4>
                );
              }
              return part.trim() ? (
                <span key={partIndex}>{part}</span>
              ) : null;
            })}
          </div>
        );
      }
      
      // Handle bullet points
      if (paragraph.includes('•') || paragraph.includes('-') || /^\d+\./.test(paragraph)) {
        const items = paragraph.split('\n').filter(item => item.trim());
        return (
          <ul key={index} className="list-disc list-inside space-y-1 mb-3">
            {items.map((item, itemIndex) => (
              <li key={itemIndex} className="text-sm">
                {item.replace(/^[•\-\d+\.]\s*/, '').trim()}
              </li>
            ))}
          </ul>
        );
      }
      
      // Handle hashtags specially for social media posts
      if ((postType === 'instagram' || postType === 'facebook') && paragraph.includes('#')) {
        const parts = paragraph.split(/(#\w+)/g);
        return (
          <p key={index} className="text-sm mb-3 leading-relaxed">
            {parts.map((part, partIndex) => 
              part.startsWith('#') ? (
                <span key={partIndex} className="text-blue-600 font-medium">{part}</span>
              ) : (
                part
              )
            )}
          </p>
        );
      }
      
      // Regular paragraphs
      return (
        <p key={index} className="text-sm mb-3 leading-relaxed">
          {paragraph.trim()}
        </p>
      );
    }).filter(Boolean);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-garden-green-dark">Review Your Content</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No content available for review</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <Card key={task.id} className="border-garden-green-light">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(task.status)}
                      <Badge variant="secondary" className={getStatusColor(task.status)}>
                        {task.status}
                      </Badge>
                      <Badge variant="outline">
                        {task.post_type}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditContent(task.id)}
                        className="border-blue-300 text-blue-600 hover:bg-blue-50"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyContent(task.ai_output, task.post_type)}
                        className="border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                      {task.status !== 'scheduled' && (
                        <Button
                          size="sm"
                          onClick={() => updateTaskStatus(task.id, 'scheduled')}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {task.ai_output && (
                    <div className="bg-gray-50 p-4 rounded-md border">
                      <div className="prose prose-sm max-w-none">
                        {formatContent(task.ai_output, task.post_type)}
                      </div>
                    </div>
                  )}
                  
                  {task.scheduled_date && (
                    <p className="text-xs text-gray-500 mt-2">
                      Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        <div className="flex justify-end pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-garden-green-light text-garden-green-dark"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
