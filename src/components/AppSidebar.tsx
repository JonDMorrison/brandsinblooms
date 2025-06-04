
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Calendar, Users, Settings, BarChart3, Home, Leaf } from "lucide-react";

interface AppSidebarProps {
  currentView: "home" | "kanban" | "calendar";
  onViewChange: (view: "home" | "kanban" | "calendar") => void;
  onboardingData: any;
}

export const AppSidebar = ({ currentView, onViewChange, onboardingData }: AppSidebarProps) => {
  const menuItems = [
    { title: "Dashboard", view: "home", icon: Home },
    { title: "Content Pipeline", view: "kanban", icon: BarChart3 },
    { title: "Campaign Calendar", view: "calendar", icon: Calendar },
  ];

  return (
    <Sidebar className="w-64 border-r border-green-200 bg-garden-sage">
      <SidebarContent>
        <div className="p-6 border-b border-green-200 bg-white">
          <div className="flex items-center gap-3 mb-2">
            <Leaf className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-garden-green-dark">Marketing Hub</h2>
          </div>
          <p className="text-sm text-garden-green font-semibold">Garden Center</p>
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
                      onClick={() => onViewChange(item.view as "home" | "kanban" | "calendar")}
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
                  <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-green-100 text-garden-green-dark transition-all duration-200">
                    <Users className="w-5 h-5" />
                    <span className="font-medium">Team</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-green-100 text-garden-green-dark transition-all duration-200">
                    <Settings className="w-5 h-5" />
                    <span className="font-medium">Settings</span>
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
