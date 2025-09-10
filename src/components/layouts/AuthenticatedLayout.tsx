import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrialBanner } from "@/components/TrialBanner";
import { UserMenu } from "@/components/UserMenu";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuthenticatedLayoutProps {
  children: ReactNode;
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

export const AuthenticatedLayout = ({ children }: AuthenticatedLayoutProps) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  if (!user) {
    return <div>Please log in to access this page</div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex">
        {/* Global Sidebar Toggle with directional arrows */}
        <SidebarToggleButton />
        
        <AppSidebar />
        <main className="flex-1 w-full h-full overflow-x-hidden flex flex-col">
          {/* Trial Banner */}
          <TrialBanner />
          
          {/* Sticky Top Bar with UserMenu */}
          <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
            <div className="flex justify-end items-center p-4">
              <UserMenu />
            </div>
          </header>
          
          <div className="flex-1 w-full h-full px-4">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};