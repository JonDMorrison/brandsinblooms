import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  User
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

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="font-bold text-xl">Bloom</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sidebarGroups.map((group, groupIndex) => (
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
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}