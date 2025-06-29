
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TrialBanner } from "@/components/TrialBanner";
import { UserMenu } from "@/components/UserMenu";

interface FullWidthLayoutProps {
  children: ReactNode;
}

export const FullWidthLayout = ({ children }: FullWidthLayoutProps) => {
  const { user } = useAuth();

  if (!user) {
    return <div>Please log in to access this page</div>;
  }

  return (
    <div className="min-h-screen w-full flex flex-col">
      {/* Trial Banner */}
      <TrialBanner />
      
      {/* Fixed UserMenu - always visible in top-right */}
      <div className="fixed top-6 right-6 z-50">
        <UserMenu />
      </div>
      
      {/* Main Content */}
      <main className="flex-1 w-full h-full">
        <div className="w-full h-full">
          {children}
        </div>
      </main>
    </div>
  );
};
