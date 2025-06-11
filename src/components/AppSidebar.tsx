
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Calendar, Users, Settings, BarChart3, Home, Leaf, Building, CreditCard } from "lucide-react";
import { EditableBusinessName } from "@/components/EditableBusinessName";
import { useNavigate, useLocation } from "react-router-dom";

interface AppSidebarProps {
  currentView: "home" | "kanban" | "calendar" | "team" | "profile";
  onViewChange: (view: "home" | "kanban" | "calendar" | "team" | "profile") => void;
  onboardingData: any;
  onBusinessNameChange?: (newName: string) => void;
}

export const AppSidebar = ({ currentView, onViewChange, onboardingData, onBusinessNameChange }: AppSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { title: "Dashboard", view: "home", icon: Home, path: "/app" },
    { title: "Content Pipeline", view: "kanban", icon: BarChart3, path: "/kanban" },
    { title: "Campaign Calendar", view: "calendar", icon: Calendar, path: "/calendar" },
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
    if (item.view === "profile") {
      navigate("/profile");
    } else if (item.view === "calendar") {
      navigate("/calendar");
    } else {
      onViewChange(item.view as "home" | "kanban" | "calendar" | "team" | "profile");
    }
  };

  return (
    <Sidebar className="w-64 border-r border-green-200 bg-garden-sage">
      <SidebarContent>
        <div className="p-6 border-b border-green-200 bg-white">
          <div className="flex items-center gap-3 mb-2">
            <Leaf className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-garden-green-dark">BloomSuite</h2>
          </div>
          <EditableBusinessName 
            businessName={businessName}
            onBusinessNameChange={handleBusinessNameChange}
          />
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-garden-green-dark font-semibold">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    className={currentView === item.view ? "bg-primary-100 text-primary-700 font-semibold border border-primary-200" : "hover:bg-green-100 text-garden-green-dark"}
                  >
                    <button
                      onClick={() => handleNavigation(item)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200"
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-garden-green-dark font-semibold">Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button 
                    onClick={() => navigate("/team")}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                      currentView === "team" 
                        ? "bg-primary-100 text-primary-700 font-semibold border border-primary-200" 
                        : "hover:bg-green-100 text-garden-green-dark"
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    <span className="font-medium">Team</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button 
                    onClick={() => navigate("/subscription")}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                      location.pathname === "/subscription" 
                        ? "bg-primary-100 text-primary-700 font-semibold border border-primary-200" 
                        : "hover:bg-green-100 text-garden-green-dark"
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span className="font-medium">Account Settings</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
