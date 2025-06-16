
import { PlusCircle, Calendar, CalendarPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UseQuickActionsProps {
  onNewCampaignClick: () => void;
  onAddEventClick: () => void;
  onViewCalendar: () => void;
}

export const useQuickActions = ({
  onNewCampaignClick,
  onAddEventClick,
  onViewCalendar
}: UseQuickActionsProps) => {
  const navigate = useNavigate();

  const handleViewCalendar = () => {
    navigate('/calendar');
  };

  return [
    {
      id: 'new-campaign',
      icon: PlusCircle,
      title: 'Create Custom Campaign',
      description: 'Build themed marketing campaigns',
      benefit: 'Get 5+ content pieces instantly',
      color: 'text-green-600',
      bgColor: 'bg-white hover:bg-gray-50',
      borderColor: 'border-gray-200 hover:border-gray-300',
      onClick: onNewCampaignClick,
      ariaLabel: 'Create a new marketing campaign'
    },
    {
      id: 'add-event',
      icon: CalendarPlus,
      title: 'Promote An Upcoming Event',
      description: 'Get help marketing your events',
      benefit: 'Custom promotional content',
      color: 'text-gray-600',
      bgColor: 'bg-white hover:bg-gray-50',
      borderColor: 'border-gray-200 hover:border-gray-300',
      onClick: onAddEventClick,
      ariaLabel: 'Add a new event to promote'
    },
    {
      id: 'view-calendar',
      icon: Calendar,
      title: 'View Content Calendar',
      description: 'See your planned content schedule',
      benefit: "Preview what's coming this year",
      color: 'text-blue-600',
      bgColor: 'bg-white hover:bg-gray-50',
      borderColor: 'border-gray-200 hover:border-gray-300',
      onClick: handleViewCalendar,
      ariaLabel: 'View content calendar'
    }
  ];
};
