import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Instagram, Facebook, Mail, BookOpen, Video, FileText, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface ReadyToPostCardProps {
  tasks: any[];
  onTaskClick?: (task: any) => void;
}

export const ReadyToPostCard = ({ tasks, onTaskClick }: ReadyToPostCardProps) => {
  const [showAllTasks, setShowAllTasks] = useState(false);
  const readyTasks = tasks.filter(task => task.status === 'scheduled');

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
      case 'instagram': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'facebook': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'email': return 'bg-green-100 text-green-800 border-green-200';
      case 'newsletter': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'video': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleCopyContent = (content: string, postType: string) => {
    const cleanContent = stripHtmlAndFormat(content);
    navigator.clipboard.writeText(cleanContent);
    toast.success(`${postType} content copied to clipboard`);
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

  if (readyTasks.length === 0) {
    return (
      <Card className="border-green-200">
        <CardHeader>
          <CardTitle className="text-lg text-green-700 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Ready to Post
          </CardTitle>
          <CardDescription>
            Approved content ready for publishing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No content ready to post</p>
            <p className="text-sm">Approve content to see it here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayedTasks = showAllTasks ? readyTasks : readyTasks.slice(0, 5);

  return (
    <Card className="border-green-200">
      <CardHeader>
        <CardTitle className="text-lg text-green-700 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Ready to Post
          <Badge className="bg-green-100 text-green-800">
            {readyTasks.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Approved content ready for publishing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayedTasks.map((task) => (
          <div
            key={task.id}
            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => onTaskClick && onTaskClick(task)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {getPostTypeIcon(task.post_type)}
                <Badge className={getPostTypeColor(task.post_type)}>
                  {task.post_type}
                </Badge>
                <Badge className="bg-green-100 text-green-800">
                  ✅ Ready
                </Badge>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyContent(task.ai_output, task.post_type);
                  }}
                  className="h-7 w-7 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.info('Post publishing integration coming soon');
                  }}
                  className="h-7 w-7 p-0"
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            {task.ai_output && (
              <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                {stripHtmlAndFormat(task.ai_output)}
              </p>
            )}
            
            {task.scheduled_date && (
              <p className="text-xs text-gray-500">
                Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
        
        {readyTasks.length > 5 && (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => setShowAllTasks(!showAllTasks)}
          >
            {showAllTasks ? 'Show Less' : `View All ${readyTasks.length} Ready Posts`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
