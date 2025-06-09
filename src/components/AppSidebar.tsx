
import { Home, BarChart3, Calendar, Building2, Users, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  currentView: "home" | "kanban" | "calendar" | "team" | "profile";
  onViewChange: (view: "home" | "kanban" | "calendar" | "team" | "profile") => void;
  onboardingData: any;
  onBusinessNameChange: (newName: string) => void;
}

export function AppSidebar({ 
  currentView, 
  onViewChange, 
  onboardingData 
}: AppSidebarProps) {
  const { collapsed } = useSidebar();
  
  const businessName = onboardingData?.aboutBusiness?.split('.')[0] || "Your Garden Center";

  const navigationItems = [
    { title: "Dashboard", view: "home" as const, icon: Home },
    { title: "Content Pipeline", view: "kanban" as const, icon: BarChart3 },
    { title: "Campaign Calendar", view: "calendar" as const, icon: Calendar },
    { title: "Company Profile", view: "profile" as const, icon: Building2 },
  ];

  const settingsItems = [
    { title: "Team", view: "team" as const, icon: Users },
  ];

  return (
    <Sidebar className="border-r border-gray-200 bg-white">
      <SidebarContent className="py-6">
        {/* Business Name Header */}
        <div className="px-6 mb-8">
          <h2 className="text-lg font-semibold text-green-600 truncate">
            {businessName}
          </h2>
        </div>

        {/* Navigation Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-6 text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-3">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.view}>
                  <SidebarMenuButton
                    onClick={() => onViewChange(item.view)}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      currentView === item.view
                        ? "bg-green-100 text-green-700 border-r-2 border-green-600"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings Section */}
        <SidebarGroup className="mt-8">
          <SidebarGroupLabel className="px-6 text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Settings
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-3">
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.view}>
                  <SidebarMenuButton
                    onClick={() => onViewChange(item.view)}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      currentView === item.view
                        ? "bg-green-100 text-green-700 border-r-2 border-green-600"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
