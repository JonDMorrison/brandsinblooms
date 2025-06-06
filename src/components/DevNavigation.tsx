
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { X } from "lucide-react";

export const DevNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(true);

  // Define all available routes/pages in the project
  const routes = [
    {
      name: "📄 Landing Page",
      path: "/?view=landing",
      requiresAuth: false,
      description: "Public landing page"
    },
    {
      name: "🔐 Auth/Login",
      path: "/auth",
      requiresAuth: false,
      description: "Authentication page"
    },
    {
      name: "📊 Dashboard (Home)",
      path: "/?view=app",
      requiresAuth: true,
      description: "Main dashboard"
    },
    {
      name: "🔄 Content Pipeline",
      path: "/?view=app&tab=kanban",
      requiresAuth: true,
      description: "Kanban board view"
    },
    {
      name: "📅 Campaign Calendar",
      path: "/?view=app&tab=calendar",
      requiresAuth: true,
      description: "Calendar view"
    },
    {
      name: "🏢 Company Profile",
      path: "/?view=app&tab=profile",
      requiresAuth: true,
      description: "Company settings"
    },
    {
      name: "👥 Team Management",
      path: "/?view=app&tab=team",
      requiresAuth: true,
      description: "Team settings"
    },
    {
      name: "❌ 404 Not Found (unlinked)",
      path: "/invalid-route",
      requiresAuth: false,
      description: "Error page test"
    }
  ];

  const getCurrentRoute = () => {
    if (location.pathname === '/auth') return "/auth";
    if (location.pathname === '/' && location.search.includes('view=landing')) return "/?view=landing";
    if (location.pathname === '/' && location.search.includes('tab=kanban')) return "/?view=app&tab=kanban";
    if (location.pathname === '/' && location.search.includes('tab=calendar')) return "/?view=app&tab=calendar";
    if (location.pathname === '/' && location.search.includes('tab=profile')) return "/?view=app&tab=profile";
    if (location.pathname === '/' && location.search.includes('tab=team')) return "/?view=app&tab=team";
    if (location.pathname === '/' && !location.search.includes('view=landing')) return "/?view=app";
    return location.pathname;
  };

  const handleRouteChange = (path: string) => {
    navigate(path);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const currentRoute = getCurrentRoute();
  const currentRouteData = routes.find(route => route.path === currentRoute);

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
      <div className="flex flex-col gap-3 min-w-[250px]">
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
        
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-gray-600">Page Selector:</label>
          <Select value={currentRoute} onValueChange={handleRouteChange}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Select a page..." />
            </SelectTrigger>
            <SelectContent>
              {routes.map((route) => (
                <SelectItem 
                  key={route.path} 
                  value={route.path}
                  disabled={route.requiresAuth && !user}
                >
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-medium">{route.name}</span>
                    <span className="text-xs text-gray-500">{route.description}</span>
                    {route.requiresAuth && !user && (
                      <span className="text-xs text-red-500">(Login required)</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {currentRouteData && (
          <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
            <strong>Current:</strong> {currentRouteData.name}
            <br />
            <strong>Path:</strong> {currentRoute}
          </div>
        )}

        {user && (
          <>
            <div className="border-t pt-2 mt-1">
              <div className="text-xs text-gray-600 mb-2">
                Logged in: {user.email?.substring(0, 25)}...
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
