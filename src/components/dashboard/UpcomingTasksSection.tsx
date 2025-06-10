
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, Clock, Eye } from "lucide-react";

interface UpcomingTasksSectionProps {
  upcomingTasks: any[];
  onTaskUpdate: () => void;
  onTaskClick?: (task: any) => void;
}

export const UpcomingTasksSection = ({
  upcomingTasks,
  onTaskUpdate,
  onTaskClick
}: UpcomingTasksSectionProps) => {
  const handleTaskClick = (task: any) => {
    if (onTaskClick) {
      onTaskClick(task);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Upcoming Tasks</h2>
      {upcomingTasks.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Next Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{task.title}</h4>
                      <Badge variant={task.status === 'draft' ? 'secondary' : 'outline'} className="text-xs">
                        {task.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">{task.content_type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.ai_output && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTaskClick(task)}
                        className="text-xs"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-2 border-gray-300 bg-gray-50">
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <div className="text-gray-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
                <p className="text-sm">
                  No pending tasks at the moment. Great work on staying organized!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
