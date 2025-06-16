
import { ReactNode } from "react";
import { AppleCard, AppleCardContent } from "@/components/ui/apple-card";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

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

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-surface-secondary">
        <AppSidebar
          currentView={currentView}
          onViewChange={onViewChange}
          onboardingData={onboardingData}
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
