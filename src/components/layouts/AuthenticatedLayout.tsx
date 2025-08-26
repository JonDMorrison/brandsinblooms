import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrialBanner } from "@/components/TrialBanner";
import { UserMenu } from "@/components/UserMenu";
import AppSidebar from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

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
        <AppSidebar />
        
        <SidebarInset>
          {/* Header with trigger and user menu */}
          <header className="h-12 flex items-center justify-between border-b px-4">
            <SidebarTrigger />
            <div className="ml-auto">
              <UserMenu />
            </div>
          </header>
          
          <main className="flex-1 w-full h-full overflow-x-hidden flex flex-col">
            {/* Trial Banner */}
            <TrialBanner />
            <div className="flex-1 w-full h-full px-4">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};