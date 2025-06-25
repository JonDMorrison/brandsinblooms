
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
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const handleCreateCampaign = async () => {
    if (!user || !title || !description || !selectedDate) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const currentWeekNumber = getCurrentWeekNumber();
      
      const { data, error } = await supabase
        .from("campaigns")
        .insert({
          title: title,
          description: description,
          start_date: selectedDate.toISOString().split("T")[0],
          user_id: user.id,
          tenant_id: tenant?.id,
          source: 'quick_action',
          week_number: currentWeekNumber
        })
        .select();

      if (error) {
        console.error("Error creating campaign:", error);
        toast.error("Failed to create campaign");
        return;
      }

      console.log("Campaign created successfully:", data);
      toast.success("Campaign created successfully!");
      setOpen(false);
      setTitle("");
      setDescription("");
      setSelectedDate(new Date());
      onCampaignCreated();
      onCreateCampaign();
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast.error("Failed to create campaign");
    }
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
      </div>

      {/* Sidebar Section */}
      <div className="xl:col-span-4 space-y-6">
        {/* Quick Action - Create Campaign */}
        <Card>
          <CardHeader>
            <CardTitle>Create Campaign</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className="justify-start text-left font-normal"
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    selectedDate?.toLocaleDateString()
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  captionLayout="dropdown"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                type="title"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button onClick={handleCreateCampaign} size="sm">
              Create
            </Button>
          </CardContent>
        </Card>

        {/* Custom Content Section */}
        <CustomContentSection
          userCreatedCampaigns={userCreatedCampaigns}
          onContentGenerated={onTaskUpdate}
        />
      </div>
    </div>
  );
};
