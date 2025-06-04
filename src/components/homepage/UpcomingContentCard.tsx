
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

interface UpcomingContentCardProps {
  upcomingContent: any[];
}

export const UpcomingContentCard = ({ upcomingContent }: UpcomingContentCardProps) => {
  if (upcomingContent.length === 0) return null;

  return (
    <Card className="shadow-lg border-blue-200 rounded-xl bg-blue-50">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-blue-800">
          <Calendar className="w-5 h-5" />
          Coming Up This Month
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcomingContent.map((task) => (
          <div key={task.id} className="flex items-center gap-3">
            <span className="text-sm">📅</span>
            <div>
              <p className="text-sm font-semibold text-blue-800">
                {task.campaigns?.title} - {task.post_type}
              </p>
              <p className="text-xs text-blue-600">
                {new Date(task.scheduled_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
        <Button variant="outline" className="w-full border-blue-300 text-blue-700 hover:bg-blue-100">
          <Calendar className="w-4 h-4 mr-2" />
          View Calendar
        </Button>
      </CardContent>
    </Card>
  );
};
