
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Navigation } from "lucide-react";

export const DevNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Define all available routes with descriptions
  const routes = [
    { path: "/", label: "Home/Dashboard", description: "Main application dashboard" },
    { path: "/auth", label: "Authentication", description: "Login/signup page" },
    { path: "/onboarding", label: "Onboarding Flow", description: "New user setup process" },
    { path: "/profile", label: "Company Profile", description: "Business profile management" },
    { path: "/calendar", label: "Campaign Calendar", description: "Content calendar view" },
    { path: "/kanban", label: "Content Pipeline", description: "Kanban board view" },
    { path: "/team", label: "Team Management", description: "Team settings and invites" },
    { path: "/analytics", label: "Analytics Dashboard", description: "Performance metrics" },
    { path: "/content-library", label: "Content Library", description: "Asset and template management" },
    { path: "/404", label: "404 Not Found", description: "Error page" },
  ];

  const handleRouteChange = (path: string) => {
    if (path === "/404") {
      navigate("/nonexistent-route"); // Navigate to trigger 404
    } else {
      navigate(path);
    }
    setIsOpen(false);
  };

  const getCurrentPageLabel = () => {
    const currentRoute = routes.find(route => route.path === location.pathname);
    return currentRoute ? currentRoute.label : "Unknown Page";
  };

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
          className="w-80 bg-white border border-gray-200 shadow-xl"
        >
          <DropdownMenuLabel className="text-sm font-semibold text-gray-700">
            Navigate to Page
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Main accessible routes */}
          <DropdownMenuItem
            onClick={() => handleRouteChange("/")}
            className={`cursor-pointer ${location.pathname === "/" ? "bg-blue-50 text-blue-700" : ""}`}
          >
            <div className="flex flex-col">
              <span className="font-medium">Home/Dashboard</span>
              <span className="text-xs text-gray-500">Main application dashboard</span>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuItem
            onClick={() => handleRouteChange("/auth")}
            className={`cursor-pointer ${location.pathname === "/auth" ? "bg-blue-50 text-blue-700" : ""}`}
          >
            <div className="flex flex-col">
              <span className="font-medium">Authentication</span>
              <span className="text-xs text-gray-500">Login/signup page</span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Unlinked Pages
          </DropdownMenuLabel>

          {/* Unlinked/internal routes */}
          {routes.slice(2).map((route) => (
            <DropdownMenuItem
              key={route.path}
              onClick={() => handleRouteChange(route.path)}
              className={`cursor-pointer ${location.pathname === route.path ? "bg-blue-50 text-blue-700" : ""}`}
            >
              <div className="flex flex-col">
                <span className="font-medium">{route.label}</span>
                <span className="text-xs text-gray-500">{route.description}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
