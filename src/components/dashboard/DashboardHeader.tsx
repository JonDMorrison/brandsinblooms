
import { CampaignDialog } from "@/components/CampaignDialog";
import { UserMenu } from "@/components/UserMenu";

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
  const getViewTitle = () => {
    switch (currentView) {
      case "home": return "Dashboard Overview";
      case "kanban": return "Content Pipeline";
      case "calendar": return "Campaign Calendar";
      case "team": return "Team Management";
      case "profile": return "Company Profile";
      default: return "Dashboard";
    }
  };

  const getViewDescription = () => {
    switch (currentView) {
      case "home": return "Your marketing hub at a glance";
      case "kanban": return "Manage your content creation workflow";
      case "calendar": return "View and schedule your marketing campaigns";
      case "team": return "Manage your team members and collaboration";
      case "profile": return "Manage your company information for AI content generation";
      default: return "";
    }
  };

  if (currentView === "home") {
    return (
      <>
        {/* Floating UserMenu - always visible */}
        <div className="fixed top-4 right-4 z-50">
          <UserMenu />
        </div>
        
        <div className="p-6 border-b border-green-200 bg-white">
          {/* Header content without UserMenu */}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Floating UserMenu - always visible */}
      <div className="fixed top-4 right-4 z-50">
        <UserMenu />
      </div>
      
      <div className="p-6 border-b border-green-200 bg-white">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-garden-green-dark">
              {getViewTitle()}
            </h1>
            <p className="text-garden-green font-medium">
              {getViewDescription()}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {currentView !== "team" && currentView !== "profile" && (
              <CampaignDialog onCampaignCreated={onCampaignCreated} />
            )}
          </div>
        </div>
      </div>
    </>
  );
};
