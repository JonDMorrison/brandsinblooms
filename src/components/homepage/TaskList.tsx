
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Eye, Calendar, Instagram, Facebook, Mail, BookOpen, Video, FileText } from "lucide-react";

interface Task {
  id: string;
  post_type: string;
  ai_output?: string;
  status: string;
  scheduled_date?: string;
  campaigns?: {
    title: string;
  };
}

interface TaskListProps {
  tasks: Task[];
  onTaskUpdate: () => void;
  onTaskClick?: (task: Task) => void;
}

export const TaskList = ({ tasks, onTaskUpdate, onTaskClick }: TaskListProps) => {
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
      case 'draft': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'scheduled': return <Calendar className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const stripHtmlAndFormat = (content: string) => {
    if (!content) return '';
    return content
      .replace(/<[^>]*>/g, '')
      .replace(/\\n/g, ' ')
      .trim();
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Content Tasks</CardTitle>
          <CardDescription>Your upcoming content creation tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No content tasks yet</p>
            <p className="text-sm">Create a campaign to generate content tasks</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Content Tasks
          <Badge variant="secondary">{tasks.length}</Badge>
        </CardTitle>
        <CardDescription>Your upcoming content creation tasks</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`border rounded-lg p-4 transition-colors ${
              onTaskClick ? 'hover:bg-gray-50 cursor-pointer' : ''
            }`}
            onClick={() => onTaskClick && onTaskClick(task)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {getPostTypeIcon(task.post_type)}
                <Badge className={getStatusColor(task.status)}>
                  {getStatusIcon(task.status)}
                  <span className="ml-1 capitalize">{task.status}</span>
                </Badge>
                <span className="text-sm font-medium capitalize">
                  {task.post_type}
                </span>
              </div>
              {onTaskClick && task.ai_output && (
                <Button variant="ghost" size="sm">
                  <Eye className="w-4 h-4" />
                </Button>
              )}
            </div>

            {task.campaigns?.title && (
              <p className="text-sm text-gray-600 mb-2">
                Campaign: {task.campaigns.title}
              </p>
            )}

            {task.ai_output && (
              <p className="text-sm text-gray-700 line-clamp-2">
                {stripHtmlAndFormat(task.ai_output)}
              </p>
            )}

            {task.scheduled_date && (
              <p className="text-xs text-gray-500 mt-2">
                Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}

        {tasks.length > 5 && (
          <Button variant="outline" className="w-full mt-4">
            View All Tasks ({tasks.length})
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
