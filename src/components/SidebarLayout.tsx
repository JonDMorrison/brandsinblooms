
import { ReactNode } from "react";
import { AppleCard, AppleCardContent } from "@/components/ui/apple-card";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "react-router-dom";

interface SidebarLayoutProps {
  children: ReactNode;
  onboardingData?: any;
  onBusinessNameChange?: (newName: string) => void;
}

export const SidebarLayout = ({
  children,
  onboardingData,
  onBusinessNameChange
}: SidebarLayoutProps) => {
  const isMobile = useIsMobile();
  const location = useLocation();

  // Determine current view based on pathname
  const getCurrentView = (): "home" | "calendar" | "team" | "profile" => {
    const path = location.pathname;
    if (path === "/calendar") return "calendar";
    if (path === "/team") return "team";
    if (path === "/profile") return "profile";
    return "home";
  };

  const currentView = getCurrentView();

  const handleViewChange = (view: "home" | "calendar" | "team" | "profile") => {
    // Navigation is handled by the sidebar itself
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-surface-secondary">
        <AppSidebar
          currentView={currentView}
          onViewChange={handleViewChange}
          onboardingData={onboardingData || {}}
          onBusinessNameChange={onBusinessNameChange}
        />
        <main className="flex-1 overflow-auto">
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
      </div>
    </SidebarProvider>
  );
};
