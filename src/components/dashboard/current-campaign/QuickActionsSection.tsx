
import { AppleCard, AppleCardContent } from "@/components/ui/apple-card";
import { HeadlineLarge } from "@/components/ui/typography";
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
    <div className="space-y-4">
      <HeadlineLarge className="text-text-primary flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        Quick Actions
      </HeadlineLarge>
      
      <AppleCard variant="elevated" className="overflow-hidden">
        <AppleCardContent className="p-4 space-y-3">
          {actionItems.map((item) => (
            <QuickActionItem key={item.id} item={item} />
          ))}
        </AppleCardContent>
      </AppleCard>
    </div>
  );
};
