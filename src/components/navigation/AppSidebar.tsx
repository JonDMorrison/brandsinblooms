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
    <Sidebar 
      variant="inset" 
      className="botanical-sidebar relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #FDFCFB 0%, #F3F8F4 100%)',
        position: 'relative',
        isolation: 'isolate'
      }}
    >
      {/* Botanical overlay as first child covering entire sidebar */}
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