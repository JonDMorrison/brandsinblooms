import {
  LayoutDashboard,
  Calendar,
  Share2,
  ClipboardList,
  Building2,
  User,
  Settings,
  LogOut,
  RotateCcw,
  TrendingUp,
  CreditCard,
  LucideIcon
} from "lucide-react";

export interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  action?: string;
  className?: string;
  adminOnly?: boolean;
}

export const navigationItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/'
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    path: '/calendar'
  },
  {
    id: 'social',
    label: 'Content Planner',
    icon: Share2,
    path: '/social'
  },
  {
    id: 'analytics',
    label: 'Analytics & Scheduling',
    icon: TrendingUp,
    path: '/social-media'
  },
  {
    id: 'content-tasks',
    label: 'Content Tasks',
    icon: ClipboardList,
    path: '/content-tasks'
  },
  {
    id: 'profile',
    label: 'Company Profile',
    icon: Building2,
    path: '/profile'
  }
];

export const accountItems: MenuItem[] = [
  {
    id: 'account',
    label: 'Account Settings',
    icon: User,
    path: '/account'
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: CreditCard,
    path: '/billing'
  },
  {
    id: 'admin',
    label: 'Admin Dashboard',
    icon: Settings,
    path: '/admin',
    adminOnly: true
  }
];

export const adminItems: MenuItem[] = [
  {
    id: 'reset',
    label: 'Reset for Testing',
    icon: RotateCcw,
    action: 'reset',
    className: 'text-orange-600 focus:text-orange-600',
    adminOnly: true
  }
];

export const actionItems: MenuItem[] = [
  {
    id: 'signout',
    label: 'Sign out',
    icon: LogOut,
    action: 'signout',
    className: 'text-red-600 focus:text-red-600 font-medium'
  }
];