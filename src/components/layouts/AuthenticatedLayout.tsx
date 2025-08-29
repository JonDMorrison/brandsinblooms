import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrialBanner } from "@/components/TrialBanner";
import { UserMenu } from "@/components/UserMenu";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/navigation/AppSidebar";

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export const AuthenticatedLayout = ({ children }: AuthenticatedLayoutProps) => {
  const { user } = useAuth();

  if (!user) {
    return <div>Please log in to access this page</div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex">
        {/* Fixed UserMenu - always visible in top-right */}
        <div className="fixed top-6 right-6 z-50">
          <UserMenu />
        </div>
        
        <AppSidebar />
        <main className="flex-1 w-full h-full overflow-x-hidden flex flex-col">
          {/* Trial Banner */}
          <TrialBanner />
          <div className="flex-1 w-full h-full px-4">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};