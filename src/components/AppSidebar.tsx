
import { Button } from "@/components/ui/button";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem 
} from "@/components/ui/sidebar";
import { 
  Calendar, 
  Users, 
  Home, 
  Leaf, 
  Building, 
  CreditCard, 
  BarChart3, 
  ChevronLeft, 
  ChevronRight, 
  Expand 
} from "lucide-react";
import { EditableBusinessName } from "@/components/EditableBusinessName";
import { useNavigate, useLocation } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";

interface AppSidebarProps {
  currentView: "home" | "calendar" | "team" | "profile";
  onViewChange: (view: "home" | "calendar" | "team" | "profile") => void;
  onboardingData: any;
  onBusinessNameChange?: (newName: string) => void;
}

export const AppSidebar = ({ 
  currentView, 
  onViewChange, 
  onboardingData, 
  onBusinessNameChange 
}: AppSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();

  const menuItems = [
    { title: "Dashboard", view: "home", icon: Home, path: "/app" },
    { title: "Campaign Calendar", view: "calendar", icon: Calendar, path: "/calendar" },
    { title: "Analytics", view: "analytics", icon: BarChart3, path: "/analytics" },
    { title: "Company Profile", view: "profile", icon: Building, path: "/profile" },
  ];

  // Extract business name from onboarding data
  const getBusinessName = () => {
    if (!onboardingData?.aboutBusiness) return "Garden Center";
    
    const aboutText = onboardingData.aboutBusiness;
    const firstSentence = aboutText.split('.')[0] || aboutText.split('\n')[0];
    
    const nameMatch = firstSentence.match(/^([^,]+(?:Garden Center|Nursery|Gardens?))/i) || 
                     firstSentence.match(/^([A-Za-z\s]+(?:Garden Center|Nursery|Gardens?))/i) ||
                     firstSentence.match(/^([A-Za-z\s&'-]+)/);
    
    if (nameMatch && nameMatch[1]) {
      return nameMatch[1].trim();
    }
    
    return "Garden Center";
  };

  const businessName = getBusinessName();
  const isCollapsed = state === "collapsed";

  const handleBusinessNameChange = (newName: string) => {
    if (onBusinessNameChange) {
      onBusinessNameChange(newName);
    }
  };

  const handleNavigation = (item: any) => {
    navigate(item.path);
  };

  return (
    <div className="relative">
      <Sidebar className={`border-r border-green-200 bg-garden-sage transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
        <SidebarContent>
          {/* Header Section */}
          <div className="relative p-4 border-b border-green-200 bg-white">
            {/* Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="absolute top-4 right-3 z-10 h-8 w-8 hover:bg-green-100"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
            
            {/* Brand Section */}
            {!isCollapsed && (
              <div className="space-y-4">
                {/* Logo and App Name */}
                <div className="flex items-center gap-3">
                  <Leaf className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-bold text-garden-green-dark">BloomSuite</h2>
                </div>
                
                {/* Business Name */}
                <div className="space-y-1">
                  <EditableBusinessName 
                    businessName={businessName}
                    onBusinessNameChange={handleBusinessNameChange}
                  />
                </div>
              </div>
            )}
            
            {/* Collapsed Brand */}
            {isCollapsed && (
              <div className="flex justify-center">
                <Leaf className="w-6 h-6 text-primary" />
              </div>
            )}
          </div>

          {/* Navigation Section */}
          <SidebarGroup>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-garden-green-dark font-semibold">
                Navigation
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => {
                  const isActive = (item.path === "/app" && location.pathname === "/app") || 
                                  (item.path !== "/app" && location.pathname === item.path);
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild
                        className={isActive 
                          ? "bg-primary-100 text-primary-700 font-semibold border border-primary-200" 
                          : "hover:bg-green-100 text-garden-green-dark"
                        }
                      >
                        <button
                          onClick={() => handleNavigation(item)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                            isCollapsed ? 'justify-center' : ''
                          }`}
                          title={isCollapsed ? item.title : undefined}
                        >
                          <item.icon className="w-5 h-5 flex-shrink-0" />
                          {!isCollapsed && <span className="font-medium">{item.title}</span>}
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Settings Section */}
          <SidebarGroup>
            {!isCollapsed && (
              <SidebarGroupLabel className="text-garden-green-dark font-semibold">
                Settings
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <button 
                      onClick={() => navigate("/team")}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                        isCollapsed ? 'justify-center' : ''
                      } ${
                        location.pathname === "/team" 
                          ? "bg-primary-100 text-primary-700 font-semibold border border-primary-200" 
                          : "hover:bg-green-100 text-garden-green-dark"
                      }`}
                      title={isCollapsed ? "Team" : undefined}
                    >
                      <Users className="w-5 h-5 flex-shrink-0" />
                      {!isCollapsed && <span className="font-medium">Team</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <button 
                      onClick={() => navigate("/subscription")}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                        isCollapsed ? 'justify-center' : ''
                      } ${
                        location.pathname === "/subscription" 
                          ? "bg-primary-100 text-primary-700 font-semibold border border-primary-200" 
                          : "hover:bg-green-100 text-garden-green-dark"
                      }`}
                      title={isCollapsed ? "Account Settings" : undefined}
                    >
                      <CreditCard className="w-5 h-5 flex-shrink-0" />
                      {!isCollapsed && <span className="font-medium">Account Settings</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {/* Floating Expand Button */}
      {isCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="fixed left-2 top-4 z-50 h-8 w-8 bg-white border border-green-200 shadow-sm hover:bg-green-50"
          title="Expand sidebar"
        >
          <Expand className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
