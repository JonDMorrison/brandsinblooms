import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Settings,
  BarChart3,
  Users,
  MessageSquare,
  Globe,
  Mail,
  Phone,
  Image,
  FileText,
  Home,
  ChevronLeft,
  ChevronRight,
  Zap,
  Store
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  description: string;
}

const navigationItems: NavItem[] = [
  {
    name: 'Overview',
    href: '/',
    icon: Home,
    description: 'Dashboard overview'
  },
  {
    name: 'Social Media',
    href: '/campaigns',
    icon: Calendar,
    description: 'Content planning'
  },
  {
    name: 'CRM',
    href: '/crm',
    icon: Users,
    description: 'Customer relationships'
  },
  {
    name: 'SMS',
    href: '/sms',
    icon: Phone,
    description: 'Text messaging'
  },
  {
    name: 'Email',
    href: '/crm/campaigns',
    icon: Mail,
    description: 'Email campaigns'
  },
  {
    name: 'Domains & Email',
    href: '/domains',
    icon: Globe,
    description: 'Domain and email setup'
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    description: 'Performance insights'
  },
  {
    name: 'Assets',
    href: '/assets',
    icon: Image,
    description: 'Media library'
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'App configuration'
  }
];

export const NavLayout = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className={`flex flex-col h-screen bg-gray-50 border-r border-gray-200 ${isCollapsed ? 'w-16' : 'w-64'} transition-width duration-300 ease-in-out`}>
      {/* Collapsible Button */}
      <div className="p-4 flex justify-end">
        <Button variant="ghost" size="icon" onClick={toggleCollapse}>
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => (
            <li key={item.name}>
              <Link
                to={item.href}
                className={`flex items-center p-2 rounded-md hover:bg-gray-100 ${isCollapsed ? 'justify-center' : ''}`}
              >
                <item.icon className="h-5 w-5 mr-2" />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Dropdown */}
      <div className="p-4 border-t border-gray-200">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                <AvatarFallback>SC</AvatarFallback>
              </Avatar>
              {!isCollapsed && <span>{user?.email}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
