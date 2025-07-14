
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2, Calendar as CalendarIcon, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { generateCampaignContent } from "./ContentGenerationServices";

interface AddEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventCreated: () => void;
}

export const AddEventDialog = ({ open, onOpenChange, onEventCreated }: AddEventDialogProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventInstructions, setEventInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [contentGenerated, setContentGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for calendar
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setEventDate(format(date, "PPP"));
      setSelectedDate(date);
      setIsCalendarOpen(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError("You must be logged in to create an event");
      return;
    }

    if (!eventName.trim()) {
      setError("Event name is required");
      return;
    }

    if (eventName.trim().length < 3) {
      setError("Event name must be at least 3 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔒 SECURITY: Creating event campaign for user:', user.id, 'tenant:', tenant?.id || 'none');

      const eventPrompt = `Promote the event "${eventName}" ${eventDescription ? `- ${eventDescription}` : ''} ${eventDate ? `scheduled for ${eventDate}` : ''}${eventInstructions ? `. Important instructions: ${eventInstructions}` : ''}. Create engaging promotional content that encourages attendance and builds excitement.`;

      // 🔒 SECURITY: Always set user_id and tenant_id for proper isolation
      const campaignData = {
        title: eventName.trim(),
        description: eventDescription.trim() || null,
        theme: `${eventName} Promotion`,
        prompt: eventPrompt,
        start_date: new Date().toISOString().split('T')[0],
        week_number: getCurrentWeekNumber(),
        source: 'quick_action',
        user_id: user.id, // 🔒 CRITICAL: Always set user_id for RLS
        created_by_user_id: user.id, // 🔒 Track who created it
        ...(tenant?.id && { tenant_id: tenant.id }) // 🔒 Set tenant_id if available
      };

      console.log('🔒 SECURITY: Creating event with proper user isolation:', {
        user_id: campaignData.user_id,
        tenant_id: campaignData.tenant_id || 'none',
        title: campaignData.title
      });

      const { data: insertedCampaign, error: insertError } = await supabase
        .from('campaigns')
        .insert(campaignData)
        .select()
        .single();

      if (insertError) {
        console.error('❌ AddEventDialog: Error creating campaign:', insertError);
        throw new Error(insertError.message);
      }

      console.log('✅ AddEventDialog: Campaign created with proper isolation:', insertedCampaign);

      // Now automatically generate content for the event using the working service
      setGeneratingContent(true);
       toast({
         title: "Generating content for your event...",
         description: "Please wait while we create your promotional content",
       });

      try {
        console.log('🔒 SECURITY: Starting content generation with proper user isolation');
        
        const result = await generateCampaignContent(
          insertedCampaign.id,
          insertedCampaign.theme || insertedCampaign.title,
          insertedCampaign.description || '',
          user.id, // 🔒 CRITICAL: Pass user_id for RLS
          insertedCampaign.week_number,
          tenant?.id // 🔒 Pass tenant_id if available
        );

        if (result.success) {
          console.log('✅ AddEventDialog: Content generated successfully with user isolation');
          setContentGenerated(true);
          toast({
            title: "Success!",
            description: `Event created with ${result.tasks?.length || 5} content pieces!`,
          });
        } else {
          console.warn('⚠️ AddEventDialog: Content generation had issues:', result.message);
          toast({
            title: "Warning",
            description: `Event created, but content generation had issues: ${result.message}`,
            variant: "destructive",
          });
        }
      } catch (contentError) {
        console.error('❌ AddEventDialog: Content generation failed:', contentError);
        toast({
          title: "Error",
          description: "Event created, but content generation failed. You can generate content manually.",
          variant: "destructive",
        });
      }

      // Reset form
      setEventName("");
      setEventDescription("");
      setEventDate("");
      setEventInstructions("");
      setSelectedDate(undefined);
      setError(null);

      // Call onEventCreated to refresh the dashboard data
      onEventCreated();

      // Close modal after short delay to show success state
      setTimeout(() => {
        onOpenChange(false);
        setContentGenerated(false);
        setGeneratingContent(false);
      }, 2000);
      
    } catch (error: any) {
      console.error('❌ AddEventDialog: Error creating event:', error);
      setError(error.message || 'Failed to create event');
      toast({
        title: "Error",
        description: error.message || 'Failed to create event',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading && !generatingContent) {
      setEventName("");
      setEventDescription("");
      setEventDate("");
      setEventInstructions("");
      setSelectedDate(undefined);
      setError(null);
      setContentGenerated(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-white z-[100] border border-gray-200 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-garden-green-dark">Add Event to Promote</DialogTitle>
        </DialogHeader>
        
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {contentGenerated && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Event created successfully with 5 content pieces! Check your dashboard to review and approve the content.
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="eventName" className="text-garden-green-dark">
              Event Name *
            </Label>
            <Input
              id="eventName"
              value={eventName}
              onChange={(e) => {
                setEventName(e.target.value);
                setError(null);
              }}
              placeholder="Enter event name"
              required
              className="border-black focus:border-black"
              disabled={loading || generatingContent}
            />
          </div>
          
          <div>
            <Label htmlFor="eventDescription" className="text-garden-green-dark">
              Event Description
            </Label>
            <Textarea
              id="eventDescription"
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              placeholder="Describe your event"
              className="border-black focus:border-black"
              disabled={loading || generatingContent}
            />
          </div>
          
          <div>
            <Label htmlFor="eventDate" className="text-garden-green-dark">
              Event Date
            </Label>
            <div className="relative">
              <Input
                id="eventDate"
                type="text"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                placeholder="e.g., March 15, 2024 or Next Friday at 7pm"
                className="border-black focus:border-black pr-10"
                disabled={loading || generatingContent}
              />
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-gray-100 z-10"
                    disabled={loading || generatingContent}
                  >
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white border border-gray-200 shadow-lg z-[110]" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div>
            <Label htmlFor="eventInstructions" className="text-garden-green-dark">
              Instructions & Deadlines
            </Label>
            <Textarea
              id="eventInstructions"
              value={eventInstructions}
              onChange={(e) => setEventInstructions(e.target.value)}
              placeholder="Add sign up deadlines, registration info, reply requirements, etc."
              className="border-black focus:border-black"
              disabled={loading || generatingContent}
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-garden-green-light text-garden-green-dark"
              disabled={loading || generatingContent}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!eventName.trim() || loading || generatingContent}
              className="bg-garden-green hover:bg-garden-green-dark text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : generatingContent ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Content...
                </>
              ) : contentGenerated ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete!
                </>
              ) : (
                'Create & Generate Content'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
