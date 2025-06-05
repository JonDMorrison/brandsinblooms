
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CampaignTasksCardProps {
  overdueTasks: any[];
}

export const CampaignTasksCard = ({ overdueTasks }: CampaignTasksCardProps) => {
  if (overdueTasks.length === 0) return null;

  return (
    <Card className="shadow-lg border-gray-200 rounded-xl bg-gray-50">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-800">
          <span className="text-xl">📋</span>
          Theme Tasks
        </CardTitle>
        <CardDescription className="text-gray-700 font-medium">
          Things to finish before this week's theme goes live
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {overdueTasks.slice(0, 3).map((task) => (
          <div key={task.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
            <span className="text-lg">⏳</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-800 text-sm">
                {task.campaigns?.title} - {task.post_type}
              </p>
              <p className="text-gray-600 text-xs font-medium">
                Due: {new Date(task.scheduled_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
