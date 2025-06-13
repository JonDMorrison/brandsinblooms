
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { QuickActionItem } from "./QuickActionItem";
import { useQuickActions } from "./useQuickActions";

interface QuickActionsSectionProps {
  onNewCampaignClick: () => void;
  onAddEventClick: () => void;
  onViewCalendar: () => void;
}

export const QuickActionsSection = ({
  onNewCampaignClick,
  onAddEventClick,
  onViewCalendar
}: QuickActionsSectionProps) => {
  const actionItems = useQuickActions({
    onNewCampaignClick,
    onAddEventClick,
    onViewCalendar
  });

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        Quick Actions
      </h3>
      <Card className="shadow-lg border-gray-200 rounded-xl bg-white">
        <CardContent className="p-4 space-y-3">
          {actionItems.map((item) => (
            <QuickActionItem key={item.id} item={item} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
