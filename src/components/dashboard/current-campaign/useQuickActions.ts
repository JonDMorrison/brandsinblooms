
import { PlusCircle, Calendar, CalendarPlus, Sparkles } from "lucide-react";

interface UseQuickActionsProps {
  onNewCampaignClick: () => void;
  onAddEventClick: () => void;
  onViewCalendar: () => void;
  onGenerateThemes?: () => void;
}

export const useQuickActions = ({
  onNewCampaignClick,
  onAddEventClick,
  onViewCalendar,
  onGenerateThemes
}: UseQuickActionsProps) => {
  return [
    {
      id: 'new-campaign',
      icon: PlusCircle,
      title: 'Create Campaign',
      description: 'Build themed marketing campaigns',
      benefit: 'Get 5+ content pieces instantly',
      color: 'text-green-600',
      bgColor: 'bg-white hover:bg-green-50',
      borderColor: 'border-gray-200 hover:border-green-300',
      onClick: onNewCampaignClick,
      ariaLabel: 'Create a new marketing campaign'
    },
    {
      id: 'add-event',
      icon: CalendarPlus,
      title: 'Promote Event',
      description: 'Get help marketing your events',
      benefit: 'Custom promotional content',
      color: 'text-blue-600',
      bgColor: 'bg-white hover:bg-blue-50',
      borderColor: 'border-gray-200 hover:border-blue-300',
      onClick: onAddEventClick,
      ariaLabel: 'Add a new event to promote'
    },
    {
      id: 'view-calendar',
      icon: Calendar,
      title: 'Content Calendar',
      description: 'See your planned content schedule',
      benefit: "Preview what's coming this year",
      color: 'text-purple-600',
      bgColor: 'bg-white hover:bg-purple-50',
      borderColor: 'border-gray-200 hover:border-purple-300',
      onClick: onViewCalendar,
      ariaLabel: 'View content calendar'
    },
    ...(onGenerateThemes ? [{
      id: 'generate-themes',
      icon: Sparkles,
      title: 'Generate Weekly Themes',
      description: 'AI-powered seasonal content themes',
      benefit: 'Fresh ideas for your garden center',
      color: 'text-purple-600',
      bgColor: 'bg-white hover:bg-purple-50',
      borderColor: 'border-gray-200 hover:border-purple-300',
      onClick: onGenerateThemes,
      ariaLabel: 'Generate AI-powered weekly themes'
    }] : [])
  ];
};
