
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

  // Determine the next step based on current state
  const getNextStep = () => {
    if (campaignsCount === 0) {
      return {
        title: "Create Your First Campaign",
        description: "Start generating marketing content for your garden center",
        action: "Create Campaign",
        icon: "🚀",
        bgColor: "bg-green-100",
        borderColor: "border-green-300",
        actionType: "create-campaign"
      };
    }
    
    if (tasksCount === 0) {
      return {
        title: "Generate Content",
        description: "Create content for your existing campaigns",
        action: "Generate Content",
        icon: "✨",
        bgColor: "bg-blue-100",
        borderColor: "border-blue-300",
        actionType: "generate-content"
      };
    }
    
    if (completedTasksCount === 0) {
      return {
        title: "Review Your Content",
        description: "Check and approve your generated marketing content",
        action: "Review This Week's Content",
        icon: "📝",
        bgColor: "bg-orange-100",
        borderColor: "border-orange-300",
        actionType: "review-content"
      };
    }
    
    return {
      title: "Great Progress!",
      description: "Keep up the momentum with your marketing efforts",
      action: "Create More",
      icon: "🎉",
      bgColor: "bg-purple-100",
      borderColor: "border-purple-300",
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
      <Card className={`shadow-lg ${nextStep.bgColor} ${nextStep.borderColor} border-2 rounded-xl`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-3xl">{nextStep.icon}</span>
              <div>
                <h3 className="text-xl font-bold text-black mb-1">
                  {nextStep.title}
                </h3>
                <p className="text-black font-medium">
                  {nextStep.description}
                </p>
              </div>
            </div>
            <Button 
              className="bg-primary hover:bg-primary-600 text-white shadow-lg text-lg px-8 py-3 h-auto"
              onClick={handleAction}
            >
              {nextStep.action}
              <ArrowRight className="w-5 h-5 ml-2" />
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
