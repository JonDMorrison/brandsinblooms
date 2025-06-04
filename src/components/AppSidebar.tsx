
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Calendar, Users, Settings, BarChart3, Home } from "lucide-react";

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
    <Sidebar className="w-64 border-r border-green-200">
      <SidebarContent>
        <div className="p-6 border-b border-green-200">
          <h2 className="text-xl font-bold text-green-800">Marketing Hub</h2>
          <p className="text-sm text-green-600">Garden Center</p>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    className={currentView === item.view ? "bg-green-100 text-green-800" : ""}
                  >
                    <button
                      onClick={() => onViewChange(item.view as "home" | "kanban" | "calendar")}
                      className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-green-50"
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-green-50">
                    <Users className="w-4 h-4" />
                    <span>Team</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-green-50">
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {onboardingData && (
          <div className="p-4 m-4 bg-green-50 rounded-lg border border-green-200">
            <h3 className="font-semibold text-green-800 text-sm mb-2">Your Setup</h3>
            <p className="text-xs text-green-600">
              Content personalized for your garden center's unique voice and events.
            </p>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
};
