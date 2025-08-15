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
    {
      title: "Content Library",
      url: "/content/library",
      icon: ClipboardList,
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
          title: "Personas",
          url: "/crm/personas",
          icon: Target,
        },
        {
          title: "Persona Analytics",
          url: "/crm/personas/analytics",
          icon: BarChart3,
        },
        {
          title: "Campaign Analytics",
          url: "/crm/analytics",
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
      title: "Settings",
      url: "/settings",
      icon: Settings,
    },
  ];

  const isActive = (path: string) => currentPath === path;

  return (
    <div className="h-full">
      <SidebarMenu>
        {sidebarItems.map((item) =>
          item.items ? (
            <Collapsible key={item.title} defaultOpen={item.items.some(subItem => isActive(subItem.url))}>
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="group w-full text-ink-1 hover:bg-white/5">
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                    <ChevronDown className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton asChild>
                          <NavLink 
                            to={subItem.url} 
                            className={({ isActive }) => 
                              isActive 
                                ? "bg-white/7 ring-1 ring-white/15 shadow-glow text-ink-1" 
                                : "text-ink-2 hover:text-ink-1 hover:bg-white/5"
                            }
                          >
                            <subItem.icon className="h-4 w-4" />
                            <span>{subItem.title}</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ) : (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild className="w-full">
                <NavLink 
                  to={item.url} 
                  className={({ isActive }) => 
                    isActive 
                      ? "bg-white/7 ring-1 ring-white/15 shadow-glow text-ink-1" 
                      : "text-ink-2 hover:text-ink-1 hover:bg-white/5"
                  }
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        )}
      </SidebarMenu>
    </div>
  );
};

export default AppSidebar;
