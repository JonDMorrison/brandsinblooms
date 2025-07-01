
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrialBanner } from "@/components/TrialBanner";
import { UserMenu } from "@/components/UserMenu";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import { FloatingFAB } from "@/components/ui/floating-fab";

interface SidebarLayoutProps {
  children: ReactNode;
}

export const SidebarLayout = ({ children }: SidebarLayoutProps) => {
  const { user } = useAuth();

  if (!user) {
    return <div>Please log in to access this page</div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex flex-col">
        {/* Trial Banner */}
        <TrialBanner />
        
        {/* Fixed UserMenu - always visible in top-right */}
        <div className="fixed top-6 right-6 z-50">
          <UserMenu />
        </div>
        
        <div className="flex flex-1 w-full min-h-0 overflow-hidden">
          <AppSidebar />
          <main className="flex-1 w-full h-full overflow-x-hidden">
            <div className="w-full h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
        
        {/* Floating FAB for Help + Notifications */}
        <FloatingFAB 
          notificationCount={0} 
          onHelpClick={() => console.log('Help clicked')}
          onNotificationClick={() => console.log('Notifications clicked')}
        />
      </div>
    </SidebarProvider>
  );
};
