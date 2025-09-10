
import { ReactNode } from "react";
import AppSidebar from "@/components/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserMenu } from "@/components/UserMenu";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardLayoutProps {
  children: ReactNode;
  currentView: "home" | "calendar" | "team" | "profile";
  onViewChange: (view: "home" | "calendar" | "team" | "profile") => void;
  onboardingData: any;
  onBusinessNameChange?: (newName: string) => void;
  onCampaignCreated?: () => void;
}

const SidebarToggleButton = () => {
  const { state, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const isCollapsed = state === "collapsed";

  return (
    <div className={`fixed top-4 left-4 z-[150] ${isMobile ? 'top-2 left-2' : ''}`}>
      <Button
        onClick={toggleSidebar}
        variant="outline"
        size="icon"
        className="bg-background border shadow-sm hover:bg-accent h-10 w-10"
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
};

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
        {/* Global Sidebar Toggle with directional arrows */}
        <SidebarToggleButton />

        <AppSidebar />
        
        {/* Sticky Top Bar with UserMenu */}
        <header className="sticky top-0 z-[150] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex justify-end items-center p-4">
            <UserMenu />
          </div>
        </header>
        
        <main className="flex-1 w-full h-full overflow-x-hidden">
          <div className="w-full h-full pt-12">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};
