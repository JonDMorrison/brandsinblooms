
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/UserMenu";

interface LandingPageHeaderProps {
  onLogin: () => void;
}

export const LandingPageHeader = ({ onLogin }: LandingPageHeaderProps) => {
  const { user } = useAuth();

  return (
    <nav className="flex justify-between items-center px-6 py-4">
      <div className="text-2xl font-bold text-garden-green-dark">
        BloomSuite
      </div>
      <div className="flex items-center gap-4">
        {user ? (
          <UserMenu />
        ) : (
          <Button 
            onClick={onLogin}
            variant="outline"
            className="border-garden-green text-garden-green hover:bg-garden-green hover:text-white"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Login
          </Button>
        )}
      </div>
    </nav>
  );
};
