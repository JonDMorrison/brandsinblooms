
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UpcomingContentModal } from "./UpcomingContentModal";

interface WhatsComingNextCardProps {
  onTaskUpdate?: () => void;
}

export const WhatsComingNextCard = ({ onTaskUpdate }: WhatsComingNextCardProps) => {
  const [selectedWeek, setSelectedWeek] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  const getUpcomingWeeks = () => {
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
        theme: getWeekTheme(i, weekStart),
        description: getWeekDescription(i, weekStart),
        contentTypes: ['Instagram Post', 'Facebook Post', 'Email Campaign', 'Newsletter', 'Video Script']
      });
    }
    
    return weeks;
  };

  const getWeekTheme = (weekIndex: number, weekStart: Date) => {
    const month = weekStart.toLocaleDateString('en-US', { month: 'long' });
    const themes = [
      "Seasonal Plant Care",
      "New Arrivals Showcase", 
      "Customer Success Stories",
      "Educational Content"
    ];
    
    return `${month} ${themes[(weekIndex - 1) % themes.length]}`;
  };

  const getWeekDescription = (weekIndex: number, weekStart: Date) => {
    const descriptions = [
      "Focus on seasonal gardening tips and plant care advice",
      "Highlight new arrivals and featured products", 
      "Share customer testimonials and success stories",
      "Provide educational how-to guides and tutorials"
    ];
    
    return descriptions[(weekIndex - 1) % descriptions.length];
  };

  const handleWeekClick = (week: any) => {
    setSelectedWeek(week);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedWeek(null);
  };

  const handleViewCalendar = () => {
    navigate('/calendar');
  };

  const upcomingWeeks = getUpcomingWeeks();

  return (
    <>
      <div>
        <h2 className="text-2xl font-semibold text-garden-green-dark mb-6 flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          What's Coming Next
        </h2>
        
        <Card>
          <CardHeader>
            <CardDescription>
              Preview and prepare content for upcoming campaigns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingWeeks.map((week) => (
              <div
                key={week.id}
                className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors group"
                onClick={() => handleWeekClick(week)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      Week {week.weekNumber}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {week.weekStart.toLocaleDateString()}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                </div>

                <h3 className="font-semibold text-gray-900 mb-1">
                  {week.theme}
                </h3>
                
                <p className="text-sm text-gray-600 mb-3">
                  {week.description}
                </p>

                <div className="flex flex-wrap gap-1">
                  {week.contentTypes.slice(0, 3).map((type, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                  {week.contentTypes.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{week.contentTypes.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            ))}

            <div className="pt-2 border-t">
              <Button variant="outline" className="w-full" onClick={handleViewCalendar}>
                <Clock className="w-4 h-4 mr-2" />
                View Full Campaign Calendar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <UpcomingContentModal
        week={selectedWeek}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onTaskUpdate={onTaskUpdate}
      />
    </>
  );
};
