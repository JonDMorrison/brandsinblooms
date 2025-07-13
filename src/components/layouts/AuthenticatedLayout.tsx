import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrialBanner } from "@/components/TrialBanner";
import { UserMenu } from "@/components/UserMenu";
import AppSidebar from "@/components/AppSidebar";

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export const AuthenticatedLayout = ({ children }: AuthenticatedLayoutProps) => {
  const { user } = useAuth();

  if (!user) {
    return <div>Please log in to access this page</div>;
  }

  return (
    <div className="min-h-screen w-full flex">
      {/* Fixed UserMenu - always visible in top-right */}
      <div className="fixed top-6 right-6 z-50">
        <UserMenu />
      </div>
      
      <AppSidebar />
      <main className="flex-1 w-full h-full overflow-x-hidden flex flex-col">
        {/* Trial Banner - constrained to main content width */}
        <TrialBanner />
        <div className="flex-1 w-full h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
};