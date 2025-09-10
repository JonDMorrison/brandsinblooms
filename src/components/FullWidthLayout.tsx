
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
      
      {/* Sticky Top Bar with UserMenu */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex justify-end items-center p-4">
          <UserMenu />
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 w-full h-full">
        <div className="w-full h-full">
          {children}
        </div>
      </main>
    </div>
  );
};
