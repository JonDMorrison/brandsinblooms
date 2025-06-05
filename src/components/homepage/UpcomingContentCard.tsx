
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

interface UpcomingContentCardProps {
  upcomingContent: any[];
  onNavigateToCalendar?: () => void;
}

export const UpcomingContentCard = ({ upcomingContent, onNavigateToCalendar }: UpcomingContentCardProps) => {
  if (upcomingContent.length === 0) return null;

  return (
    <Card className="shadow-lg border-green-200 rounded-xl bg-green-50">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-black">
          <Calendar className="w-5 h-5" />
          Coming Up This Month
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcomingContent.map((task) => (
          <div key={task.id} className="flex items-center gap-3">
            <span className="text-sm">📅</span>
            <div>
              <p className="text-sm font-semibold text-black">
                {task.campaigns?.title} - {task.post_type}
              </p>
              <p className="text-xs text-gray-600">
                {new Date(task.scheduled_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
        <Button 
          variant="outline" 
          className="w-full border-green-300 text-green-700 hover:bg-green-100"
          onClick={onNavigateToCalendar}
        >
          <Calendar className="w-4 h-4 mr-2" />
          View Calendar
        </Button>
      </CardContent>
    </Card>
  );
};
