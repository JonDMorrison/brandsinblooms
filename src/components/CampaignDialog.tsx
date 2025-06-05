
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CampaignDialogProps {
  onCampaignCreated?: () => void;
  trigger?: React.ReactNode;
}

export const CampaignDialog = ({ onCampaignCreated, trigger }: CampaignDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [weekNumber, setWeekNumber] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !startDate || !weekNumber) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('campaigns')
        .insert({
          title: title.trim(),
          prompt: prompt.trim() || null,
          start_date: format(startDate, 'yyyy-MM-dd'),
          week_number: parseInt(weekNumber)
        });

      if (error) throw error;

      toast({
        title: "Event added",
        description: "Your new event has been created and promotional materials will be generated",
      });

      // Reset form
      setTitle("");
      setPrompt("");
      setStartDate(undefined);
      setWeekNumber("");
      setOpen(false);
      
      onCampaignCreated?.();
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-primary hover:bg-primary-600 text-white shadow-md">
            <Plus className="w-4 h-4 mr-2" />
            Add an Event
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event Name *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Spring Plant Sale, Pruning Workshop"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="week-number">Week Number *</Label>
            <Input
              id="week-number"
              type="number"
              value={weekNumber}
              onChange={(e) => setWeekNumber(e.target.value)}
              placeholder="e.g., 12"
              min="1"
              max="53"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Event Start Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt">Event Details & Goals</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the event, target audience, key messages, or special promotions..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating Event..." : "Create Event & Generate Materials"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
