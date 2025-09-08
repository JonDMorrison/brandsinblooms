import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logoImage from "@/assets/bloomsuite-logo-correct.png";
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  BarChart3, 
  Calendar,
  Users, 
  Settings, 
  Bell,
  MessageSquare,
  Mail,
  Target,
  UserCircle,
  Zap,
  PlusCircle,
  Database,
  TrendingUp,
  Layers,
  LifeBuoy,
  Palette,
  Share2,
  BookOpen,
  User,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
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
  SidebarRail,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
// import { LogoWithText } from '@/components/ui/logo';

interface SidebarItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isActive?: boolean;
}

interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

export function AppSidebar() {
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  const sidebarGroups: SidebarGroup[] = [
    {
      label: "Overview",
      items: [
        {
          title: "Dashboard",
          url: "/",
          icon: Home,
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
        }
      ]
    },
    {
      label: "CRM & Marketing",
      items: [
        {
          title: "Customers",
          url: "/crm/customers",
          icon: Users,
        },
        {
          title: "Campaigns",
          url: "/crm/campaigns",
          icon: Mail,
        },
        {
          title: "Automations",
          url: "/crm/automations",
          icon: Zap,
        },
        {
          title: "Segments",
          url: "/crm/segments",
          icon: Target,
        },
        {
          title: "Personas",
          url: "/crm/personas",
          icon: UserCircle,
        }
      ]
    },
    {
      label: "Content & Publishing",
      items: [
        {
          title: "Social Media",
          url: "/social-accounts",
          icon: Share2,
        },
        {
          title: "Newsletter",
          url: "/newsletters/new",
          icon: BookOpen,
        },
        {
          title: "SMS Campaigns",
          url: "/sms",
          icon: MessageSquare,
        }
      ]
    },
    {
      label: "Settings & Support",
      items: [
        {
          title: "Integrations",
          url: "/integrations",
          icon: Layers,
        },
        {
          title: "Profile",
          url: "/profile",
          icon: User,
        },
        {
          title: "Account",
          url: "/account",
          icon: Settings,
        },
        {
          title: "Support",
          url: "/support",
          icon: LifeBuoy,
        }
      ]
    }
  ];

  const isItemActive = (url: string) => {
    if (url === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(url);
  };

  const isGroupActive = (items: SidebarItem[]) => {
    return items.some(item => isItemActive(item.url));
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="flex items-center justify-between px-4 py-2 h-12">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center">
              <img 
                src={logoImage} 
                alt="BloomSuite Logo" 
                className="w-full h-full object-contain"
                style={{ background: 'transparent' }}
              />
            </div>
            {!isCollapsed && (
              <span className="font-bold text-xl tracking-tight">BloomSuite</span>
            )}
          </Link>
          <Button
            onClick={toggleSidebar}
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-primary hover:text-white"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sidebarGroups.map((group, groupIndex) => {
          const isExpanded = isGroupActive(group.items);
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive = isItemActive(item.url);
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild 
                          isActive={isActive}
                          className="group"
                          data-testid={`sidebar-link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <Link to={item.url}>
                            <item.icon className="w-4 h-4" />
                            <span>{item.title}</span>
                            {item.badge && (
                              <Badge variant="secondary" className="ml-auto">
                                {item.badge}
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
              {groupIndex < sidebarGroups.length - 1 && <SidebarSeparator />}
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}