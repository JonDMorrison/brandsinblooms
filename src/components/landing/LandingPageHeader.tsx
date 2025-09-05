
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/UserMenu";

interface LandingPageHeaderProps {
  onLogin: () => void;
  showUserMenu?: boolean; // Add prop to control user menu visibility
}

export const LandingPageHeader = ({ onLogin, showUserMenu = true }: LandingPageHeaderProps) => {
  const { user } = useAuth();

  return (
    <nav className="flex justify-between items-center px-6 py-4 relative z-50">
      <div className="flex items-center gap-4">
        <div className="text-2xl font-bold text-primary">
          BloomSuite
        </div>
      </div>
      <div className="flex items-center gap-4">
        {user && showUserMenu ? (
          <UserMenu />
        ) : !user ? (
          <Button 
            onClick={onLogin}
            variant="secondary"
            className="bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-800 border-gray-200 border focus:ring-gray-300 transition-all duration-200"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Login
          </Button>
        ) : null}
      </div>
    </nav>
  );
};
