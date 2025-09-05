import React from "react";
// import logoImage from "@/assets/bloomsuite-logo.png";
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
import { useLocation } from "react-router-dom";
import { NavLink } from '@/components/ui/link';
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
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Campaigns",
      url: "/campaigns",
      icon: Send,
      items: [
        {
          title: "Newsletters",
          url: "/newsletters",
          icon: Mail,
        },
        {
          title: "SMS/MMS",
          url: "/sms",
          icon: Send,
        },
        {
          title: "Social Media",
          url: "/campaigns",
          icon: Send,
        },
      ],
    },
    {
      title: "Automations",
      url: "/crm/automations",
      icon: Zap,
    },
    {
      title: "Contacts",
      url: "/crm/customers",
      icon: Users,
    },
    {
      title: "Content",
      url: "/content",
      icon: ClipboardList,
      items: [
        {
          title: "Media Library",
          url: "/content/library",
          icon: ClipboardList,
        },
        {
          title: "Templates",
          url: "/templates",
          icon: ClipboardList,
        },
      ],
    },
    {
      title: "Website",
      url: "/website/app",
      icon: Building2,
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: BarChart3,
    },
    {
      title: "Calendar",
      url: "/calendar",
      icon: Calendar,
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
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex flex-row items-center justify-between p-4">
        <NavLink to="/dashboard" className="font-semibold flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-teal-500 to-teal-700 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          {!isCollapsed && <span>BloomSuite</span>}
        </NavLink>
        <SidebarTrigger className="ml-auto" />
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarItems.map((item) =>
                item.items ? (
                  <Collapsible key={item.title} defaultOpen={item.items.some(subItem => isActive(subItem.url))}>
                    <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton className="group w-full">
                            <item.icon className="h-4 w-4" />
                            {!isCollapsed && <span>{item.title}</span>}
                            {!isCollapsed && <ChevronDown className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />}
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
                     <SidebarMenuButton asChild className="w-full">
                        <NavLink 
                          to={item.url} 
                          className={({ isActive }) => isActive ? "bg-accent text-accent-foreground" : ""}
                        >
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
