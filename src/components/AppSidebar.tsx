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
    <Sidebar 
      collapsible="icon" 
      className="botanical-sidebar"
      style={{
        background: 'linear-gradient(180deg, #FDFCFB 0%, #F3F8F4 100%)',
        position: 'relative',
        isolation: 'isolate'
      }}
    >
      {/* Botanical overlay covering entire sidebar */}
      <div 
        className="botanical-overlay pointer-events-none" 
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '0',
          zIndex: 0,
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)'
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '0',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232E7D32' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: '160% 160%',
            backgroundPosition: '20% 0%',
            opacity: 1,
            filter: 'blur(1px)'
          }}
        />
      </div>
      
      <SidebarHeader className="flex flex-row items-center justify-between p-4" style={{ position: 'relative', zIndex: 1 }}>
        <NavLink to="/" className="font-semibold flex items-center gap-2 relative z-10">
          <img 
            src="/lovable-uploads/0f4633b7-e7b8-4e10-9689-79903579db38.png" 
            alt="BloomSuite Logo" 
            className="h-6 w-6 flex-shrink-0" 
          />
          {!isCollapsed && <span>BloomSuite</span>}
        </NavLink>
        <SidebarTrigger className="ml-auto relative z-10" />
      </SidebarHeader>
      
      <SidebarContent style={{ position: 'relative', zIndex: 1 }}>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarItems.map((item) =>
                item.items ? (
                  <Collapsible key={item.title} defaultOpen={item.items.some(subItem => isActive(subItem.url))}>
                    <SidebarMenuItem>
                         <CollapsibleTrigger asChild>
                           <SidebarMenuButton className="group w-full" data-active={item.items.some(subItem => isActive(subItem.url))}>
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
                                   <NavLink 
                                     to={subItem.url} 
                                     className={({ isActive }) => isActive ? "bg-accent text-accent-foreground" : ""}
                                     data-active={isActive(subItem.url)}
                                   >
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
                      <SidebarMenuButton 
                        asChild 
                        className="w-full" 
                        data-active={isActive(item.url)}
                      >
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
