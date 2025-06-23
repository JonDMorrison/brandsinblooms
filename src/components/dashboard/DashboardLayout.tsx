
import { ReactNode } from "react";
import AppSidebar from "@/components/AppSidebar";
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
      <AppSidebar />
      <main className="flex-1 w-full h-full overflow-x-hidden">
        {/* UserMenu for non-home pages */}
        {!isHomePage && (
          <div className={`fixed top-6 right-6 z-50 ${isMobile ? 'top-2 right-2' : ''}`}>
            <UserMenu />
          </div>
        )}
        
        <div className="w-full h-full">
          {children}
        </div>
      </main>
    </>
  );
};
