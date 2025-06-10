import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentWeekNumber } from "./homepageUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AddEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventCreated: () => void;
}

export const AddEventDialog = ({ open, onOpenChange, onEventCreated }: AddEventDialogProps) => {
  const { user } = useAuth();
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventInstructions, setEventInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    setLoading(true);
    setError(null);

    try {
      console.log('AddEventDialog: Creating event campaign:', eventName);

      const eventPrompt = `Promote the event "${eventName}" ${eventDescription ? `- ${eventDescription}` : ''} ${eventDate ? `scheduled for ${eventDate}` : ''}${eventInstructions ? `. Important instructions: ${eventInstructions}` : ''}. Create engaging promotional content that encourages attendance and builds excitement.`;

      const { data, error: insertError } = await supabase
        .from('campaigns')
        .insert({
          title: eventName,
          description: eventDescription || null,
          theme: `${eventName} Promotion`,
          prompt: eventPrompt,
          start_date: new Date().toISOString().split('T')[0],
          week_number: getCurrentWeekNumber(),
          source: 'quick_action'
        })
        .select()
        .single();

      if (insertError) {
        console.error('AddEventDialog: Error creating campaign:', insertError);
        throw new Error(insertError.message);
      }

      console.log('AddEventDialog: Campaign created successfully:', data);

      // Reset form
      setEventName("");
      setEventDescription("");
      setEventDate("");
      setEventInstructions("");
      setError(null);

      onEventCreated();
      onOpenChange(false);
      
    } catch (error: any) {
      console.error('AddEventDialog: Error creating event:', error);
      setError(error.message || 'Failed to create event');
      toast.error(error.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setEventName("");
      setEventDescription("");
      setEventDate("");
      setEventInstructions("");
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-garden-green-dark">Add Event to Promote</DialogTitle>
        </DialogHeader>
        
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
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
              disabled={loading}
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
              disabled={loading}
            />
          </div>
          
          <div>
            <Label htmlFor="eventDate" className="text-garden-green-dark">
              Event Date
            </Label>
            <Input
              id="eventDate"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="border-black focus:border-black"
              disabled={loading}
            />
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
              disabled={loading}
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-garden-green-light text-garden-green-dark"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!eventName.trim() || loading}
              className="bg-garden-green hover:bg-garden-green-dark text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Event Campaign'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
