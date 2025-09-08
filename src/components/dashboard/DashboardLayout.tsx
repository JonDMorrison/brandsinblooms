
import { ReactNode } from "react";
import AppSidebar from "@/components/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserMenu } from "@/components/UserMenu";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

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
      <div className="min-h-screen w-full flex">
        {/* Global Sidebar Toggle - Always visible, including on mobile */}
        <div className={`fixed top-4 left-4 z-[150] ${isMobile ? 'top-2 left-2' : ''}`}>
          <SidebarTrigger className="bg-background border shadow-sm hover:bg-accent" />
        </div>

        <AppSidebar />
        
        {/* Fixed UserMenu - always visible in top-right */}
        <div className={`fixed top-6 right-6 z-[150] ${isMobile ? 'top-2 right-2' : ''}`}>
          <UserMenu />
        </div>
        
        <main className="flex-1 w-full h-full overflow-x-hidden">
          <div className="w-full h-full pt-12">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};
