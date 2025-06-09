
import { CampaignDialog } from "@/components/CampaignDialog";

interface DashboardHeaderProps {
  currentView: "home" | "kanban" | "calendar" | "team" | "profile";
  onCampaignCreated: () => void;
  onboardingData?: any;
  onBusinessNameChange?: (newName: string) => void;
  isLoading?: boolean;
}

export const DashboardHeader = ({ 
  currentView, 
  onCampaignCreated,
  onboardingData,
  onBusinessNameChange,
  isLoading 
}: DashboardHeaderProps) => {
  // Don't show header for home view as it has its own welcome section
  if (currentView === "home") {
    return null;
  }

  const getViewTitle = () => {
    switch (currentView) {
      case "kanban": return "Content Pipeline";
      case "calendar": return "Campaign Calendar";
      case "team": return "Team Management";
      case "profile": return "Company Profile";
      default: return "Dashboard";
    }
  };

  const getViewDescription = () => {
    switch (currentView) {
      case "kanban": return "Manage your content creation workflow";
      case "calendar": return "View and schedule your marketing campaigns";
      case "team": return "Manage your team members and collaboration";
      case "profile": return "Manage your company information for AI content generation";
      default: return "";
    }
  };

  return (
    <div className="p-6 border-b border-gray-200 bg-white">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {getViewTitle()}
          </h1>
          <p className="text-gray-600 font-medium">
            {getViewDescription()}
          </p>
        </div>
        {currentView !== "team" && currentView !== "profile" && (
          <CampaignDialog onCampaignCreated={onCampaignCreated} />
        )}
      </div>
    </div>
  );
};
