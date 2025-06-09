import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Navigation, Crown } from "lucide-react";

export const DevNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Only show dev navigation for the master admin user
  const isMasterAdmin = user?.email === "jon@getclear.ca";
  if (!isMasterAdmin) {
    return null;
  }

  const handleRouteChange = (path: string) => {
    if (path === "/404") {
      navigate("/nonexistent-route"); // Navigate to trigger 404
    } else {
      navigate(path);
    }
    setIsOpen(false);
  };

  const getCurrentPageLabel = () => {
    const allRoutes = [...publicRoutes, ...appRoutes, ...adminRoutes, ...devShortcuts];
    const currentRoute = allRoutes.find(route => {
      if (route.path.includes("?")) {
        // For routes with query params, check both path and search
        const [routePath, routeQuery] = route.path.split("?");
        return location.pathname === routePath && location.search.includes(routeQuery);
      }
      return route.path === location.pathname;
    });
    return currentRoute ? currentRoute.label : "Unknown Page";
  };

  const isCurrentRoute = (path: string) => {
    if (path.includes("?")) {
      const [routePath, routeQuery] = path.split("?");
      return location.pathname === routePath && location.search.includes(routeQuery);
    }
    return location.pathname === path;
  };

  const renderRouteItem = (route: any) => (
    <DropdownMenuItem
      key={route.path}
      onClick={() => handleRouteChange(route.path)}
      className={`cursor-pointer ${isCurrentRoute(route.path) ? "bg-blue-50 text-blue-700" : ""}`}
    >
      <div className="flex flex-col">
        <span className="font-medium">{route.label}</span>
        <span className="text-xs text-gray-500">{route.description}</span>
      </div>
    </DropdownMenuItem>
  );

  // Define public routes
  const publicRoutes = [
    { path: "/", label: "Public Landing Page", description: "Marketing/public homepage" },
    { path: "/auth", label: "Authentication", description: "Login/signup page" },
    { path: "/pricing", label: "Pricing Page", description: "Public pricing information" },
  ];

  // Define protected app routes
  const appRoutes = [
    { path: "/app", label: "Main App", description: "Goes through normal flow (landing → onboarding → dashboard)" },
    { path: "/onboarding", label: "Onboarding Flow", description: "New user setup process" },
    { path: "/profile", label: "Company Profile", description: "Business profile management" },
    { path: "/calendar", label: "Campaign Calendar", description: "Content calendar view" },
    { path: "/kanban", label: "Content Pipeline", description: "Kanban board view" },
    { path: "/team", label: "Team Management", description: "Team settings and invites" },
    { path: "/analytics", label: "Analytics Dashboard", description: "Performance metrics" },
    { path: "/content-library", label: "Content Library", description: "Asset and template management" },
    { path: "/subscription", label: "Subscription", description: "Billing and subscription management" },
  ];

  // Define admin routes (only visible to master admin)
  const adminRoutes = isMasterAdmin ? [
    { path: "/admin", label: "Master Admin Settings", description: "System configuration and AI resource management" },
  ] : [];

  // Define dev shortcuts
  const devShortcuts = [
    { path: "/app?view=app", label: "Skip to Dashboard", description: "Bypass onboarding, go straight to main dashboard" },
    { path: "/app?view=landing", label: "App Landing", description: "Landing page for authenticated users" },
    { path: "/404", label: "404 Not Found", description: "Error page" },
  ];

  return (
    <div className="fixed top-4 left-4 z-50">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="bg-white/95 backdrop-blur-sm border border-gray-200 shadow-lg hover:bg-gray-50"
          >
            <Navigation className="w-4 h-4 mr-2" />
            Page: {getCurrentPageLabel()}
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          className="w-80 bg-white border border-gray-200 shadow-xl max-h-96 overflow-y-auto"
        >
          <DropdownMenuLabel className="text-sm font-semibold text-gray-700">
            Navigate to Page
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Public Routes */}
          <DropdownMenuLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Public Routes
          </DropdownMenuLabel>
          {publicRoutes.map(renderRouteItem)}

          <DropdownMenuSeparator />

          {/* Protected App Routes */}
          <DropdownMenuLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Protected App Routes
          </DropdownMenuLabel>
          {appRoutes.map(renderRouteItem)}

          {/* Admin Routes (only for master admin) */}
          {adminRoutes.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-medium text-red-600 uppercase tracking-wide flex items-center gap-1">
                <Crown className="w-3 h-3" />
                Master Admin Routes
              </DropdownMenuLabel>
              {adminRoutes.map(renderRouteItem)}
            </>
          )}

          <DropdownMenuSeparator />

          {/* Dev Shortcuts */}
          <DropdownMenuLabel className="text-xs font-medium text-blue-600 uppercase tracking-wide">
            🚀 Dev Shortcuts
          </DropdownMenuLabel>
          {devShortcuts.map(renderRouteItem)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
