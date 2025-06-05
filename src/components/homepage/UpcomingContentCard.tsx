
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

interface UpcomingContentCardProps {
  upcomingContent: any[];
  onNavigateToCalendar?: () => void;
}

export const UpcomingContentCard = ({ upcomingContent, onNavigateToCalendar }: UpcomingContentCardProps) => {
  // Generate next 4 weeks overview
  const getNextFourWeeksOverview = () => {
    const weeks = [];
    const today = new Date();
    
    for (let i = 1; i <= 4; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + (i * 7));
      
      const weekNumber = Math.ceil(((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(weekStart.getFullYear(), 0, 1).getDay() + 1) / 7);
      
      weeks.push({
        id: i,
        weekNumber,
        weekStart,
        title: `Week ${weekNumber} Campaign`,
        description: getWeekDescription(i, weekStart)
      });
    }
    
    return weeks;
  };

  const getWeekDescription = (weekIndex: number, weekStart: Date) => {
    const month = weekStart.toLocaleDateString('en-US', { month: 'long' });
    const themes = [
      "Seasonal gardening tips and plant care",
      "New arrivals and featured products",
      "Customer success stories and testimonials", 
      "Educational content and how-to guides"
    ];
    
    return `${month} focus: ${themes[(weekIndex - 1) % themes.length]}`;
  };

  const nextFourWeeks = getNextFourWeeksOverview();

  return (
    <Card className="shadow-lg border-green-200 rounded-xl bg-green-50">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-black">
          <Calendar className="w-5 h-5" />
          Coming Up Next Month
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {nextFourWeeks.map((week) => (
          <div key={week.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-100">
            <span className="text-sm mt-1">📅</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-black">
                {week.title}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {week.description}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Week of {week.weekStart.toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
        <Button 
          variant="outline" 
          className="w-full border-green-300 text-green-700 hover:bg-green-100 mt-4"
          onClick={onNavigateToCalendar}
        >
          <Calendar className="w-4 h-4 mr-2" />
          View Full Calendar
        </Button>
      </CardContent>
    </Card>
  );
};
