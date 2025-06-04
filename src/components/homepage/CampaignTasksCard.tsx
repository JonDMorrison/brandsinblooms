
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CampaignTasksCardProps {
  overdueTasks: any[];
}

export const CampaignTasksCard = ({ overdueTasks }: CampaignTasksCardProps) => {
  if (overdueTasks.length === 0) return null;

  return (
    <Card className="shadow-lg border-amber-200 rounded-xl bg-amber-50">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-amber-800">
          <span className="text-xl">📋</span>
          Campaign Tasks
        </CardTitle>
        <CardDescription className="text-amber-700 font-medium">
          Things to finish before this week's campaign goes live
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {overdueTasks.slice(0, 3).map((task) => (
          <div key={task.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-amber-200">
            <span className="text-lg">⏳</span>
            <div className="flex-1">
              <p className="font-semibold text-amber-800 text-sm">
                {task.campaigns?.title} - {task.post_type}
              </p>
              <p className="text-amber-600 text-xs font-medium">
                Due: {new Date(task.scheduled_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
