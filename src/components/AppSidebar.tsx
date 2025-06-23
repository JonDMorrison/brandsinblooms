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
  CopyCheck,
  ListChecks,
  ClipboardList,
  FileSearch2,
  FileSliders,
  ScrollText,
  Sparkles,
  BadgeCheck,
  Bell,
  ClipboardCopy,
  ClipboardCheck,
  ClipboardEdit,
  ClipboardType,
  ClipboardX,
  ClipboardList as ClipboardListIcon,
  FileText as FileTextIcon,
  FileSearch2 as FileSearch2Icon,
  FileSliders as FileSlidersIcon,
  ScrollText as ScrollTextIcon,
  Sparkles as SparklesIcon,
  BadgeCheck as BadgeCheckIcon,
  Bell as BellIcon,
  ClipboardCopy as ClipboardCopyIcon,
  ClipboardCheck as ClipboardCheckIcon,
  ClipboardEdit as ClipboardEditIcon,
  ClipboardType as ClipboardTypeIcon,
  ClipboardX as ClipboardXIcon,
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
      title: "Campaigns",
      url: "/campaigns",
      icon: ListChecks,
    },
    {
      title: "Content Tasks",
      url: "/content-tasks",
      icon: ClipboardList,
    },
    {
      title: "Theme Generator",
      url: "/theme-generator",
      icon: Sparkles,
    },
    {
      title: "Content Generator",
      url: "/content-generator",
      icon: ScrollText,
    },
    {
      title: "Hashtag Generator",
      url: "/hashtag-generator",
      icon: BadgeCheck,
    },
    {
      title: "Social Media",
      url: "/social",
      icon: Share2,
    },
    {
      title: "AI Tools",
      url: "/ai-tools",
      icon: Lightbulb,
      items: [
        {
          title: "Image Upscaler",
          url: "/ai-tools/image-upscaler",
          icon: FileSliders,
        },
        {
          title: "Image Generator",
          url: "/ai-tools/image-generator",
          icon: FileSearch2,
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

  return (
    <div className="w-64 flex-shrink-0 border-r bg-secondary">
      <div className="flex h-16 items-center px-4">
        <NavLink to="/" className="font-semibold">
          BloomBoost
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
