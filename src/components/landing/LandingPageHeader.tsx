
import { Button } from "@/components/ui/button";
import { LogIn, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/UserMenu";
import { useNavigate } from "react-router-dom";

interface LandingPageHeaderProps {
  onLogin: () => void;
  showUserMenu?: boolean; // Add prop to control user menu visibility
}

export const LandingPageHeader = ({ onLogin, showUserMenu = true }: LandingPageHeaderProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleReturnToDashboard = () => {
    navigate('/app');
  };

  return (
    <nav className="flex justify-between items-center px-6 py-4">
      <div className="flex items-center gap-4">
        {user && (
          <Button 
            onClick={handleReturnToDashboard}
            variant="outline"
            className="!border-garden-green !text-garden-green hover:!bg-garden-green hover:!text-white focus:!ring-garden-green focus:!border-garden-green"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Dashboard
          </Button>
        )}
        <div className="text-2xl font-bold text-garden-green-dark">
          BloomSuite
        </div>
      </div>
      <div className="flex items-center gap-4">
        {user && showUserMenu ? (
          <UserMenu />
        ) : !user ? (
          <Button 
            onClick={onLogin}
            variant="outline"
            className="!border-garden-green !text-garden-green hover:!bg-garden-green hover:!text-white focus:!ring-garden-green focus:!border-garden-green transition-all duration-200"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Login
          </Button>
        ) : null}
      </div>
    </nav>
  );
};
