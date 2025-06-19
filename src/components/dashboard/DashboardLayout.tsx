
import { ReactNode } from "react";
import { AppleCard, AppleCardContent } from "@/components/ui/apple-card";
import { AppSidebar } from "@/components/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserMenu } from "@/components/UserMenu";
import { useLocation } from "react-router-dom";

interface DashboardLayoutProps {
  children: ReactNode;
  currentView: "home" | "calendar" | "team" | "profile";
  onViewChange: (view: "home" | "calendar" | "team" | "profile") => void;
  onboardingData: any;
  onBusinessNameChange?: (newName: string) => void;
  onCampaignCreated?: () => void;
}

export const DashboardLayout = ({
  children,
  currentView,
  onViewChange,
  onboardingData,
  onBusinessNameChange,
  onCampaignCreated
}: DashboardLayoutProps) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const isHomePage = location.pathname === "/app";

  return (
    <>
      <AppSidebar
        currentView={currentView}
        onViewChange={onViewChange}
        onboardingData={onboardingData}
        onBusinessNameChange={onBusinessNameChange}
      />
      <main className="flex-1 overflow-auto relative">
        {/* UserMenu for non-home pages */}
        {!isHomePage && (
          <div className={`fixed top-6 right-6 z-50 ${isMobile ? 'top-2 right-2' : ''}`}>
            <UserMenu />
          </div>
        )}
        
        <div className={`
          max-w-7xl mx-auto 
          ${isMobile ? 'mobile-safe-area dashboard-container' : 'p-6'}
        `}>
          <AppleCard 
            variant="default" 
            surface="primary" 
            className={`
              min-h-screen border-0 shadow-none
              ${isMobile ? 'apple-card-mobile-optimized' : ''}
            `}
          >
            <AppleCardContent className={`
              ${isMobile ? 'apple-card-content-mobile' : 'p-6'}
            `}>
              {children}
            </AppleCardContent>
          </AppleCard>
        </div>
      </main>
    </>
  );
};
