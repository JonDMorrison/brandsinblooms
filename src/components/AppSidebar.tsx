import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger } from "@/components/ui/sidebar";
import { Calendar, Users, Settings, Home, Leaf, Building, CreditCard, BarChart3, ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { EditableBusinessName } from "@/components/EditableBusinessName";
import { useNavigate, useLocation } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";

interface AppSidebarProps {
  currentView: "home" | "calendar" | "team" | "profile";
  onViewChange: (view: "home" | "calendar" | "team" | "profile") => void;
  onboardingData: any;
  onBusinessNameChange?: (newName: string) => void;
}

export const AppSidebar = ({ currentView, onViewChange, onboardingData, onBusinessNameChange }: AppSidebarProps) => {
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
    
    // Try to extract business name from the first sentence or line
    const aboutText = onboardingData.aboutBusiness;
    const firstSentence = aboutText.split('.')[0] || aboutText.split('\n')[0];
    
    // Look for common patterns like "Business Name has been..." or "Business Name is..."
    const nameMatch = firstSentence.match(/^([^,]+(?:Garden Center|Nursery|Gardens?))/i) || 
                     firstSentence.match(/^([A-Za-z\s]+(?:Garden Center|Nursery|Gardens?))/i) ||
                     firstSentence.match(/^([A-Za-z\s&'-]+)/);
    
    if (nameMatch && nameMatch[1]) {
      return nameMatch[1].trim();
    }
    
    return "Garden Center";
  };

  const businessName = getBusinessName();

  const handleBusinessNameChange = (newName: string) => {
    if (onBusinessNameChange) {
      onBusinessNameChange(newName);
    }
  };

  const handleNavigation = (item: any) => {
    // Navigate directly to the path for all items
    navigate(item.path);
  };

  const isCollapsed = state === "collapsed";

  return (
    <div className="relative">
      <Sidebar className={`border-r border-green-200 bg-garden-sage transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
        <SidebarContent>
          {/* Header with toggle button */}
          <div className="p-4 border-b border-green-200 bg-white relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="absolute top-4 right-2 z-10 h-8 w-8 hover:bg-green-100"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
            
            {!isCollapsed && (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <Leaf className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-bold text-garden-green-dark">BloomSuite</h2>
                </div>
                <EditableBusinessName 
                  businessName={businessName}
                  onBusinessNameChange={handleBusinessNameChange}
                />
              </>
            )}
            
            {isCollapsed && (
              <div className="flex justify-center">
                <Leaf className="w-6 h-6 text-primary" />
              </div>
            )}
          </div>

          <SidebarGroup>
            {!isCollapsed && <SidebarGroupLabel className="text-garden-green-dark font-semibold">Navigation</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => {
                  const isActive = (item.path === "/app" && location.pathname === "/app") || 
                                  (item.path !== "/app" && location.pathname === item.path);
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild
                        className={isActive ? "bg-primary-100 text-primary-700 font-semibold border border-primary-200" : "hover:bg-green-100 text-garden-green-dark"}
                      >
                        <button
                          onClick={() => handleNavigation(item)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${isCollapsed ? 'justify-center' : ''}`}
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

          <SidebarGroup>
            {!isCollapsed && <SidebarGroupLabel className="text-garden-green-dark font-semibold">Settings</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <button 
                      onClick={() => navigate("/team")}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${isCollapsed ? 'justify-center' : ''} ${
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
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${isCollapsed ? 'justify-center' : ''} ${
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

      {/* Floating expand button when collapsed */}
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
