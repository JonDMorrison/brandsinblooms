import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { X } from "lucide-react";

export const DevNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(true);

  const handleLandingView = () => {
    if (user) {
      // If logged in, go to index and show landing
      navigate('/?view=landing');
    } else {
      // If not logged in, go to auth then back to index
      navigate('/');
    }
  };

  const handleDashboardView = () => {
    if (user) {
      navigate('/?view=app');
    } else {
      navigate('/');
    }
  };

  const handleAuthView = () => {
    navigate('/auth');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-50 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 h-8"
      >
        🚧 DEV
      </Button>
    );
  }

  return (
    <Card className="fixed top-4 left-4 z-50 p-3 bg-white/95 backdrop-blur-sm border-2 border-blue-200 shadow-lg">
      <div className="flex flex-col gap-2 min-w-[200px]">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-blue-700">
            🚧 DEV NAVIGATION
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-6 w-6 p-0 hover:bg-gray-200"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="flex flex-col gap-1">
          <Button
            variant={location.pathname === '/' && location.search.includes('view=landing') ? "default" : "outline"}
            size="sm"
            onClick={handleLandingView}
            className="text-xs"
          >
            📄 Landing Page
          </Button>
          
          <Button
            variant={location.pathname === '/auth' ? "default" : "outline"}
            size="sm"
            onClick={handleAuthView}
            className="text-xs"
          >
            🔐 Login/Auth
          </Button>
          
          <Button
            variant={location.pathname === '/' && !location.search.includes('view=landing') ? "default" : "outline"}
            size="sm"
            onClick={handleDashboardView}
            className="text-xs"
            disabled={!user}
          >
            📊 Dashboard
          </Button>
        </div>

        {user && (
          <>
            <div className="border-t pt-2 mt-1">
              <div className="text-xs text-gray-600 mb-1">
                Logged in: {user.email?.substring(0, 20)}...
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleSignOut}
                className="text-xs w-full"
              >
                Sign Out
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
