
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrialBanner } from "@/components/TrialBanner";
import { UserMenu } from "@/components/UserMenu";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";

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
            <div className="w-full h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
