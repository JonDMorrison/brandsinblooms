
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface AddEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventCreated: () => void;
}

export const AddEventDialog = ({ open, onOpenChange, onEventCreated }: AddEventDialogProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDate, setEventDate] = useState<Date>();
  const [targetAudience, setTargetAudience] = useState("");
  const [keyMessages, setKeyMessages] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!eventName.trim() || !eventDate) {
      toast.error("Please fill in the event name and date");
      return;
    }

    setLoading(true);

    try {
      // Calculate week number from event date
      const eventYear = eventDate.getFullYear();
      const firstDayOfYear = new Date(eventYear, 0, 1);
      const pastDaysOfYear = (eventDate.getTime() - firstDayOfYear.getTime()) / 86400000;
      const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

      // Create campaign for the event
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          title: eventName.trim(),
          description: eventDescription.trim() || null,
          start_date: format(eventDate, 'yyyy-MM-dd'),
          week_number: weekNumber,
          theme: eventName.trim(),
          prompt: `Event: ${eventName}. Description: ${eventDescription}. Target Audience: ${targetAudience}. Key Messages: ${keyMessages}`.trim()
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Generate content for all 5 platforms
      const contentTypes = ['facebook', 'instagram', 'video', 'newsletter', 'email'];
      const contentPromises = contentTypes.map(async (postType) => {
        try {
          // Generate content using OpenAI
          const { data: contentData, error: contentError } = await supabase.functions.invoke('generate-content', {
            body: {
              postType,
              campaignTitle: eventName,
              userId: user?.id
            }
          });

          if (contentError) {
            console.error(`Error generating ${postType} content:`, contentError);
            return null;
          }

          // Create content task
          const { error: taskError } = await supabase
            .from('content_tasks')
            .insert({
              campaign_id: campaign.id,
              post_type: postType,
              ai_output: contentData.content,
              status: 'draft',
              hashtags: getHashtagsForType(postType),
              image_idea: getImageIdeaForType(postType),
              scheduled_date: format(eventDate, 'yyyy-MM-dd')
            });

          if (taskError) {
            console.error(`Error creating ${postType} task:`, taskError);
            return null;
          }

          return postType;
        } catch (error) {
          console.error(`Error with ${postType}:`, error);
          return null;
        }
      });

      const results = await Promise.all(contentPromises);
      const successfulContent = results.filter(Boolean);

      toast.success(`Event created! Generated ${successfulContent.length} pieces of content for review.`);

      // Reset form
      setEventName("");
      setEventDescription("");
      setEventDate(undefined);
      setTargetAudience("");
      setKeyMessages("");
      onOpenChange(false);
      onEventCreated();

    } catch (error: any) {
      console.error('Error creating event:', error);
      toast.error(error.message || "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  const getHashtagsForType = (postType: string) => {
    switch (postType) {
      case 'facebook':
        return '#Event #GardenCenter #Community';
      case 'instagram':
        return '#Event #GardenLife #Plants #Instagram';
      case 'video':
        return '#EventVideo #GardenTips #Tutorial';
      case 'newsletter':
        return '#Newsletter #EventAnnouncement #Community';
      case 'email':
        return '#EventEmail #Newsletter #Community';
      default:
        return '#Event #GardenCenter';
    }
  };

  const getImageIdeaForType = (postType: string) => {
    switch (postType) {
      case 'facebook':
        return 'Event announcement image with date and key details';
      case 'instagram':
        return 'Square event promo image with vibrant garden elements';
      case 'video':
        return 'Video thumbnail featuring event highlights and garden imagery';
      case 'newsletter':
        return 'Newsletter header with event branding and seasonal elements';
      case 'email':
        return 'Email header with event details and garden center branding';
      default:
        return 'Event promotional image';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="eventName">Event Name *</Label>
            <Input
              id="eventName"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g., Spring Plant Sale, Pruning Workshop"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="eventDescription">Event Description</Label>
            <Textarea
              id="eventDescription"
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              placeholder="Describe what the event is about..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Event Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !eventDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {eventDate ? format(eventDate, "PPP") : "When is the event?"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={eventDate}
                  onSelect={setEventDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetAudience">Target Audience</Label>
            <Input
              id="targetAudience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g., New gardeners, Experienced plant enthusiasts"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="keyMessages">Key Messages & Goals</Label>
            <Textarea
              id="keyMessages"
              value={keyMessages}
              onChange={(e) => setKeyMessages(e.target.value)}
              placeholder="What are the main points you want to communicate? Any special offers or highlights?"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Event & Generating Content...
                </>
              ) : (
                "Create Event & Generate Content"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
