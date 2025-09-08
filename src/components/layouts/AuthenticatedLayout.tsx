import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrialBanner } from "@/components/TrialBanner";
import { UserMenu } from "@/components/UserMenu";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export const AuthenticatedLayout = ({ children }: AuthenticatedLayoutProps) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  if (!user) {
    return <div>Please log in to access this page</div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex">
        {/* Global Sidebar Toggle - Always visible */}
        <div className={`fixed top-4 left-4 z-50 ${isMobile ? 'top-2 left-2' : ''}`}>
          <SidebarTrigger className="bg-background border shadow-sm hover:bg-accent" />
        </div>
        
        {/* Fixed UserMenu - always visible in top-right */}
        <div className={`fixed top-6 right-6 z-50 ${isMobile ? 'top-2 right-2' : ''}`}>
          <UserMenu />
        </div>
        
        <AppSidebar />
        <main className="flex-1 w-full h-full overflow-x-hidden flex flex-col">
          {/* Trial Banner */}
          <TrialBanner />
          <div className="flex-1 w-full h-full px-4 pt-16">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};