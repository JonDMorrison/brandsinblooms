
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface Task {
  id: string;
  post_type: string;
  status: string;
  scheduled_date: string;
  ai_output: string;
  hashtags: string[];
  image_idea: string;
}

interface TaskListProps {
  tasks: Task[];
  onTaskUpdate: () => void;
}

export const TaskList = ({ tasks, onTaskUpdate }: TaskListProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'review': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'published': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-500">No content tasks yet</p>
          <p className="text-gray-400 text-sm">Tasks will appear here when campaigns are created</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.slice(0, 5).map((task) => (
        <Card key={task.id} className="border-garden-green-light">
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-garden-green-dark capitalize">
                  {task.post_type}
                </h4>
                <Badge className={getStatusColor(task.status)}>
                  {task.status}
                </Badge>
              </div>
              <span className="text-sm text-garden-green">
                {formatDistanceToNow(new Date(task.scheduled_date), { addSuffix: true })}
              </span>
            </div>
            
            {task.ai_output && (
              <p className="text-garden-green text-sm mb-2 line-clamp-2">
                {task.ai_output.substring(0, 100)}...
              </p>
            )}
            
            {task.hashtags && task.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {task.hashtags.slice(0, 3).map((tag, index) => (
                  <span key={index} className="text-xs bg-garden-green-light text-garden-green-dark px-2 py-1 rounded">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      
      {tasks.length > 5 && (
        <Card>
          <CardContent className="text-center py-4">
            <p className="text-garden-green">
              {tasks.length - 5} more tasks available
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
