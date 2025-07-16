import React from "react";
import {
  LayoutDashboard,
  Send,
  Calendar,
  ClipboardList,
  Trophy,
  Puzzle,
  Zap,
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  Settings,
  ChevronDown,
  LucideIcon,
  UserCircle,
  Target,
  Mail,
  BarChart3,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useProFeatures } from "@/hooks/useProFeatures";

interface SidebarItem {
  title: string;
  url: string;
  icon: LucideIcon;
  items?: SidebarItem[];
}

const AppSidebar: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { isPro } = useProFeatures();
  const location = useLocation();
  const { state } = useSidebar();
  
  const currentPath = location.pathname;
  const isCollapsed = state === "collapsed";

  const sidebarItems: SidebarItem[] = [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Company Profile",
      url: "/profile",
      icon: Building2,
    },
    {
      title: "Publish Portal",
      url: "/publish",
      icon: Send,
    },
    {
      title: "Calendar",
      url: "/calendar",
      icon: Calendar,
    },
    {
      title: "Social Media",
      url: "/social-accounts",
      icon: Send,
    },
    ...(isPro ? [{
      title: "CRM",
      url: "/crm",
      icon: UserCircle,
      items: [
        {
          title: "Dashboard",
          url: "/crm",
          icon: BarChart3,
        },
        {
          title: "Customers",
          url: "/crm/customers",
          icon: Users,
        },
        {
          title: "Segments",
          url: "/crm/segments",
          icon: Target,
        },
        {
          title: "Persona Analytics",
          url: "/crm/personas/analytics",
          icon: BarChart3,
        },
        {
          title: "Campaigns",
          url: "/crm/campaigns",
          icon: Mail,
        },
      ],
    }] : []),
    {
      title: "Advanced",
      url: "/integrations",
      icon: Settings,
      items: [
        {
          title: "Success Metrics",
          url: "/success",
          icon: Trophy,
        },
        {
          title: "Integrations",
          url: "/integrations",
          icon: Puzzle,
        },
        {
          title: "Automation",
          url: "/automation",
          icon: Zap,
        },
      ],
    },
    {
      title: "Account",
      url: "/account",
      icon: Users,
    },
    {
      title: "Billing",
      url: "/billing",
      icon: CreditCard,
    },
  ];

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar collapsible="icon" className="sidebar border-r">
      <SidebarHeader className="flex flex-row items-center justify-between p-4">
        <NavLink to="/" className="font-semibold flex items-center gap-2">
          <img 
            src="/lovable-uploads/0f4633b7-e7b8-4e10-9689-79903579db38.png" 
            alt="BloomSuite Logo" 
            className="h-6 w-6 flex-shrink-0" 
          />
          {!isCollapsed && <span>BloomSuite</span>}
        </NavLink>
        <SidebarTrigger className="ml-auto" />
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarItems.map((item) =>
                item.items ? (
                  <Collapsible key={item.title} defaultOpen={item.items.some(subItem => isActive(subItem.url))}>
                    <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton className="group" asChild>
                            <NavLink to={item.url} className={({ isActive }) => isActive ? "bg-accent text-accent-foreground" : ""}>
                              <item.icon className="h-4 w-4" />
                              {!isCollapsed && <span>{item.title}</span>}
                              {!isCollapsed && <ChevronDown className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />}
                            </NavLink>
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                      {!isCollapsed && (
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton asChild>
                                  <NavLink to={subItem.url} className={({ isActive }) => isActive ? "bg-accent text-accent-foreground" : ""}>
                                    <subItem.icon className="h-4 w-4" />
                                    <span>{subItem.title}</span>
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      )}
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={({ isActive }) => isActive ? "bg-accent text-accent-foreground" : ""}>
                        <item.icon className="h-4 w-4" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebar;
