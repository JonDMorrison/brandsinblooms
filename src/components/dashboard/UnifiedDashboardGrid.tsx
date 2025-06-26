
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { addMonths, subMonths } from "date-fns";
import { CalendarDays, ChevronsLeft, ChevronsRight, PieChart } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { CustomContentSection } from "./custom-content/CustomContentSection";
import { CurrentCampaignSection } from "./CurrentCampaignSection";
import { CampaignCleanupButton } from '@/components/admin/CampaignCleanupButton';
import { QuickActionsSection } from "./QuickActionsSection";
import { NewCampaignDialog } from "@/components/homepage/NewCampaignDialog";
import { AddEventDialog } from "@/components/homepage/AddEventDialog";
import { ReadyToPostCard } from "@/components/homepage/ReadyToPostCard";
import { getCurrentWeekNumber } from "@/utils/dateUtils";

interface UnifiedDashboardGridProps {
  activeCampaign: any;
  userCreatedCampaigns: any[];
  tasks: any[];
  onTaskUpdate: () => void;
  onCampaignCreated: () => void;
  onCampaignUpdate: () => void;
  onCreateCampaign: () => void;
}

export const UnifiedDashboardGrid = ({
  activeCampaign,
  userCreatedCampaigns,
  tasks,
  onTaskUpdate,
  onCampaignCreated,
  onCampaignUpdate,
  onCreateCampaign
}: UnifiedDashboardGridProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [showNewCampaignDialog, setShowNewCampaignDialog] = useState(false);
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);

  const handleNewCampaignCreate = (newCampaign: any) => {
    setShowNewCampaignDialog(false);
    onCampaignCreated();
    onCreateCampaign();
  };

  const handleEventCreated = () => {
    setShowAddEventDialog(false);
    onCampaignCreated();
    onCreateCampaign();
  };

  const handleViewCalendar = () => {
    window.location.href = '/calendar';
  };

  const handleTaskClick = (task: any) => {
    // Scroll to the task in the ReadyToPostSection
    const taskElement = document.getElementById(`task-${task.id}`);
    if (taskElement) {
      taskElement.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      // Add a highlight effect
      taskElement.classList.add("ring-2", "ring-blue-500");
      setTimeout(() => {
        taskElement.classList.remove("ring-2", "ring-blue-500");
      }, 2000); // Remove highlight after 2 seconds
    } else {
      console.warn(`Task element not found: task-${task.id}`);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full">
      {/* Development/Admin Tools */}
      <div className="xl:col-span-12 flex justify-end">
        <CampaignCleanupButton />
      </div>

      {/* Current Campaign Section */}
      <div className="xl:col-span-8 space-y-6" data-section="weekly-content-section">
        <CurrentCampaignSection
          activeCampaign={activeCampaign}
          tasks={tasks}
          onTaskUpdate={onTaskUpdate}
          onCreateCampaign={onCreateCampaign}
          onCampaignCreated={onCampaignCreated}
          onTaskClick={handleTaskClick}
        />

        {/* Ready to Post Section */}
        <ReadyToPostCard 
          tasks={tasks}
          onTaskUpdate={onTaskUpdate}
        />
      </div>

      {/* Sidebar Section */}
      <div className="xl:col-span-4 space-y-6">
        {/* Quick Actions Section */}
        <QuickActionsSection onCampaignCreated={onCampaignCreated} />

        {/* Custom Content Section */}
        <CustomContentSection
          userCreatedCampaigns={userCreatedCampaigns}
          onContentGenerated={onTaskUpdate}
        />
      </div>

      {/* Dialogs */}
      <NewCampaignDialog 
        open={showNewCampaignDialog} 
        onOpenChange={setShowNewCampaignDialog} 
        onCreate={handleNewCampaignCreate} 
      />

      <AddEventDialog 
        open={showAddEventDialog}
        onOpenChange={setShowAddEventDialog}
        onEventCreated={handleEventCreated}
      />
    </div>
  );
};
