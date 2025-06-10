import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ArrowRight, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UpcomingContentModal } from "./UpcomingContentModal";
import { supabase } from "@/integrations/supabase/client";

interface WhatsComingNextCardProps {
  onTaskUpdate?: () => void;
}

interface WeekData {
  id: number;
  weekNumber: number;
  weekStart: Date;
  title: string;
  theme: string;
  description: string;
  summary?: string;
  headline?: string;
  contentTypes: string[];
}

export const WhatsComingNextCard = ({ onTaskUpdate }: WhatsComingNextCardProps) => {
  const [selectedWeek, setSelectedWeek] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [loadingSummaries, setLoadingSummaries] = useState<Record<number, boolean>>({});
  const [loadingHeadlines, setLoadingHeadlines] = useState<Record<number, boolean>>({});
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

  const generateWeeklySummary = async (week: WeekData) => {
    if (week.summary || loadingSummaries[week.id]) return;

    setLoadingSummaries(prev => ({ ...prev, [week.id]: true }));

    try {
      const { data, error } = await supabase.functions.invoke('generate-weekly-summary', {
        body: {
          theme: week.theme,
          weekNumber: week.weekNumber,
          date: week.weekStart.toLocaleDateString()
        }
      });

      if (error) {
        console.error('Error generating weekly summary:', error);
        return;
      }

      if (data?.summary) {
        setWeeks(prevWeeks => 
          prevWeeks.map(w => 
            w.id === week.id 
              ? { ...w, summary: data.summary }
              : w
          )
        );
      }
    } catch (error) {
      console.error('Error generating weekly summary:', error);
    } finally {
      setLoadingSummaries(prev => ({ ...prev, [week.id]: false }));
    }
  };

  const generateWeeklyHeadline = async (week: WeekData) => {
    if (week.headline || loadingHeadlines[week.id]) return;

    setLoadingHeadlines(prev => ({ ...prev, [week.id]: true }));

    try {
      const { data, error } = await supabase.functions.invoke('generate-weekly-summary', {
        body: {
          theme: week.theme,
          weekNumber: week.weekNumber,
          date: week.weekStart.toLocaleDateString(),
          type: 'headline'
        }
      });

      if (error) {
        console.error('Error generating weekly headline:', error);
        return;
      }

      if (data?.summary) {
        setWeeks(prevWeeks => 
          prevWeeks.map(w => 
            w.id === week.id 
              ? { ...w, headline: data.summary }
              : w
          )
        );
      }
    } catch (error) {
      console.error('Error generating weekly headline:', error);
    } finally {
      setLoadingHeadlines(prev => ({ ...prev, [week.id]: false }));
    }
  };

  useEffect(() => {
    const initialWeeks = getUpcomingWeeks();
    setWeeks(initialWeeks);
    
    // Generate summaries and headlines for all weeks
    initialWeeks.forEach(week => {
      generateWeeklySummary(week);
      generateWeeklyHeadline(week);
    });
  }, []);

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

  return (
    <>
      <div className="bg-white">
        <h2 className="text-2xl font-semibold text-garden-green-dark mb-6 flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          What's Coming Next
        </h2>
        
        <Card className="bg-white border-gray-200">
          <CardHeader className="bg-white">
            <CardDescription className="text-foreground">
              Preview and prepare content for upcoming campaigns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 bg-white">
            {weeks.map((week) => (
              <div
                key={week.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors group bg-white"
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

                {loadingHeadlines[week.id] ? (
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3 h-3 animate-pulse text-blue-500" />
                    <div className="h-5 bg-gray-200 rounded animate-pulse flex-1"></div>
                  </div>
                ) : (
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {week.headline || week.theme}
                  </h3>
                )}
                
                {loadingSummaries[week.id] ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                    <Sparkles className="w-3 h-3 animate-pulse" />
                    <span>Generating exciting preview...</span>
                  </div>
                ) : week.summary ? (
                  <p className="text-sm text-gray-700 mb-3 font-medium leading-relaxed">
                    {week.summary}
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 mb-3">
                    {week.description}
                  </p>
                )}

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

            <div className="pt-2 border-t border-gray-200 bg-white">
              <Button variant="outline" className="w-full bg-white border-gray-200" onClick={handleViewCalendar}>
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
