
import { AppleCard, AppleCardContent } from "@/components/ui/apple-card";
import { HeadlineLarge } from "@/components/ui/typography";
import { Sparkles } from "lucide-react";
import { QuickActionItem } from "./QuickActionItem";
import { useQuickActions } from "./useQuickActions";
import { useNavigate } from "react-router-dom";
import { SmartThemeSelector } from "@/components/dashboard/SmartThemeSelector";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

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
  const navigate = useNavigate();
  const [showThemeGenerator, setShowThemeGenerator] = useState(false);
  
  const actionItems = useQuickActions({
    onNewCampaignClick,
    onAddEventClick,
    onViewCalendar: () => navigate('/calendar'),
    onGenerateThemes: () => setShowThemeGenerator(true)
  });

  return (
    <>
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

      <Dialog open={showThemeGenerator} onOpenChange={setShowThemeGenerator}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Weekly Theme Generator</DialogTitle>
          </DialogHeader>
          <SmartThemeSelector />
        </DialogContent>
      </Dialog>
    </>
  );
};
