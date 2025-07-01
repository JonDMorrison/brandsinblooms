import React from "react";
import {
  Home,
  Calendar,
  Settings,
  BarChart,
  Lightbulb,
  Share2,
  LayoutDashboard,
  Mail,
  CheckSquare,
  KanbanSquare,
  HelpCircle,
  Plus,
  BookOpenCheck,
  MessageSquare,
  Users,
  FileText,
  LucideIcon,
  Activity,
  CreditCard,
  ClipboardList,
  TrendingUp,
  Building2,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
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

  const sidebarItems: SidebarItem[] = [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Publish Portal",
      url: "/publish",
      icon: Share2,
    },
    {
      title: "Calendar",
      url: "/calendar",
      icon: Calendar,
    },
    {
      title: "Social Media",
      url: "/social",
      icon: Share2,
      items: [
        {
          title: "Content Planner",
          url: "/social",
          icon: Share2,
        },
        {
          title: "Analytics & Scheduling",
          url: "/social-media",
          icon: TrendingUp,
        },
      ],
    },
    {
      title: "Content Tasks",
      url: "/content-tasks",
      icon: ClipboardList,
    },
    {
      title: "Company Profile",
      url: "/profile",
      icon: Building2,
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

  return (
    <div className="w-64 flex-shrink-0 border-r bg-secondary">
      <div className="flex h-16 items-center px-4">
        <NavLink to="/" className="font-semibold flex items-center gap-2">
          <img 
            src="/lovable-uploads/0f4633b7-e7b8-4e10-9689-79903579db38.png" 
            alt="BloomSuite Logo" 
            className="h-6 w-6" 
          />
          BloomSuite
        </NavLink>
      </div>
      
      <nav className="h-[calc(100vh-4rem)] overflow-y-auto py-6 text-sm">
        {sidebarItems.map((item) =>
          item.items ? (
            <Accordion type="single" collapsible key={item.title}>
              <AccordionItem value={item.title}>
                <AccordionTrigger className="group flex items-center justify-between px-4 py-2 hover:bg-accent hover:text-accent-foreground">
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <nav className="flex flex-col pl-4">
                    {item.items.map((subItem) => (
                      <NavLink
                        to={subItem.url}
                        key={subItem.title}
                        className={({ isActive }) =>
                          `flex items-center gap-2 px-4 py-2 hover:bg-accent hover:text-accent-foreground ${
                            isActive ? "font-medium" : ""
                          }`
                        }
                      >
                        <subItem.icon className="h-4 w-4" />
                        <span>{subItem.title}</span>
                      </NavLink>
                    ))}
                  </nav>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : (
            <NavLink
              to={item.url}
              key={item.title}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 hover:bg-accent hover:text-accent-foreground ${
                  isActive ? "font-medium" : ""
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </NavLink>
          )
        )}
      </nav>
    </div>
  );
};

export default AppSidebar;
