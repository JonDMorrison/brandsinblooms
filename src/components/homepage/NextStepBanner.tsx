
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Sparkles } from "lucide-react";
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
        title: "🚀 Let's Create Your First Campaign!",
        description: "Create a marketing theme and we'll generate 5+ ready-to-use content pieces for you in seconds.",
        action: "Create Your First Campaign",
        mobileAction: "Create Campaign",
        icon: "✨",
        bgColor: "bg-gradient-to-r from-primary/10 to-primary/5",
        borderColor: "border-primary/30",
        actionType: "create-campaign",
        highlight: "Get instant content: Instagram posts, Facebook updates, email newsletters, and more!"
      };
    }
    
    if (tasksCount === 0) {
      return {
        title: "✨ Ready to Generate Amazing Content?",
        description: "Your campaign is set up! Now let's create personalized content that speaks to your customers.",
        action: "Generate Content Now",
        mobileAction: "Generate Content",
        icon: "🎯",
        bgColor: "bg-gradient-to-r from-blue-50 to-blue-25",
        borderColor: "border-blue-200",
        actionType: "generate-content",
        highlight: "This takes just 30 seconds and creates a week's worth of marketing materials."
      };
    }
    
    if (completedTasksCount === 0) {
      return {
        title: "📝 Your Content is Ready to Review!",
        description: "We've generated personalized marketing content for you.",
        action: "Review Your Content",
        mobileAction: "Review Content",
        icon: "👀",
        bgColor: "bg-gradient-to-r from-green-50 to-green-25",
        borderColor: "border-green-200",
        actionType: "review-content",
        highlight: "Edit, approve, or regenerate any piece until it's perfect for your brand."
      };
    }
    
    return {
      title: "🎉 Fantastic Progress!",
      description: "You're doing great! Your marketing content is ready to help grow your garden center.",
      action: "Create Another Campaign",
      mobileAction: "Create Campaign",
      icon: "🌟",
      bgColor: "bg-gradient-to-r from-purple-50 to-purple-25",
      borderColor: "border-purple-200",
      actionType: "create-more",
      highlight: "Keep the momentum going with fresh content themes and ideas."
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
        toast.info("💡 Go to your campaigns below and click 'Generate Content' to create your marketing materials!", {
          duration: 4000
        });
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
    toast.success("🎉 Campaign created! Ready to generate amazing content.", { duration: 3000 });
  };

  return (
    <>
      <Card className={`shadow-md ${nextStep.bgColor} ${nextStep.borderColor} border-2 rounded-xl overflow-hidden max-w-full`}>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
            <div className="flex flex-col gap-4 flex-1 min-w-0">
              <div className="flex-1 space-y-2 sm:space-y-3 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-foreground break-words">
                  {nextStep.title}
                </h3>
                <p className="text-gray-700 text-sm leading-relaxed break-words">
                  {nextStep.description}
                </p>
                {nextStep.highlight && (
                  <div className="flex items-start sm:items-center gap-2 text-sm font-medium text-current opacity-90">
                    <CheckCircle className="w-4 h-4 mt-0.5 sm:mt-0 flex-shrink-0" />
                    <span className="leading-relaxed break-words">{nextStep.highlight}</span>
                  </div>
                )}
              </div>
            </div>
            <Button 
              className="bg-primary hover:bg-primary-600 text-white shadow-md px-3 sm:px-6 py-3 font-semibold border hover:scale-105 transition-all duration-200 w-full sm:w-auto flex-shrink-0"
              onClick={handleAction}
            >
              <span className="hidden sm:inline truncate">{nextStep.action}</span>
              <span className="sm:hidden truncate">{nextStep.mobileAction}</span>
              <ArrowRight className="w-4 h-4 ml-2 flex-shrink-0" />
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
