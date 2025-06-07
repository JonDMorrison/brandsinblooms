import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { NewCampaignDialog } from "./NewCampaignDialog";
import { ContentReviewDialog } from "./ContentReviewDialog";
import { toast } from "sonner";

interface NextStepBannerProps {
  campaignsCount: number;
  tasksCount: number;
  completedTasksCount: number;
  onCampaignCreated: () => void;
}

export const NextStepBanner = ({ campaignsCount, tasksCount, completedTasksCount, onCampaignCreated }: NextStepBannerProps) => {
  const [showNewCampaignDialog, setShowNewCampaignDialog] = useState(false);
  const [showContentReviewDialog, setShowContentReviewDialog] = useState(false);

  const getNextStep = () => {
    if (campaignsCount === 0) {
      return {
        title: "Create Your First Campaign",
        description: "Start generating marketing content for your garden center",
        action: "Create Campaign",
        icon: "🚀",
        bgColor: "bg-garden-background",
        borderColor: "border-border/50",
        actionType: "create-campaign"
      };
    }
    
    if (tasksCount === 0) {
      return {
        title: "Generate Content",
        description: "Create content for your existing campaigns",
        action: "Generate Content",
        icon: "✨",
        bgColor: "bg-garden-background",
        borderColor: "border-border/50",
        actionType: "generate-content"
      };
    }
    
    if (completedTasksCount === 0) {
      return {
        title: "Review Your Content",
        description: "Check and approve your generated marketing content",
        action: "Review This Week's Content",
        icon: "📝",
        bgColor: "bg-garden-background",
        borderColor: "border-border/50",
        actionType: "review-content"
      };
    }
    
    return {
      title: "Great Progress!",
      description: "Keep up the momentum with your marketing efforts",
      action: "Create More",
      icon: "🎉",
      bgColor: "bg-garden-background",
      borderColor: "border-border/50",
      actionType: "create-more"
    };
  };

  const nextStep = getNextStep();

  const handleAction = () => {
    switch (nextStep.actionType) {
      case "create-campaign":
      case "create-more":
        setShowNewCampaignDialog(true);
        break;
      case "generate-content":
        toast.info("Go to your campaigns and click 'Generate Content' to create marketing materials");
        break;
      case "review-content":
        setShowContentReviewDialog(true);
        break;
      default:
        onCampaignCreated();
    }
  };

  const handleCampaignCreate = (newCampaign: any) => {
    setShowNewCampaignDialog(false);
    onCampaignCreated();
  };

  return (
    <>
      <Card className={`shadow-sm ${nextStep.bgColor} ${nextStep.borderColor} border rounded-xl`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-2xl opacity-80">{nextStep.icon}</span>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {nextStep.title}
                </h3>
                <p className="text-black text-sm">
                  {nextStep.description}
                </p>
              </div>
            </div>
            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm px-6 py-2"
              onClick={handleAction}
            >
              {nextStep.action}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <NewCampaignDialog 
        open={showNewCampaignDialog} 
        onOpenChange={setShowNewCampaignDialog} 
        onCreate={handleCampaignCreate} 
      />
      
      <ContentReviewDialog 
        open={showContentReviewDialog}
        onOpenChange={setShowContentReviewDialog}
      />
    </>
  );
};
