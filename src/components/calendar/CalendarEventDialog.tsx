import { useEffect, useState } from "react";
import Alert from "@mui/joy/Alert";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { Sparkles } from "lucide-react";
import { format, getISOWeek } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";

interface CalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventCreated: () => void;
  defaultDate?: Date | null;
}

export function CalendarEventDialog({
  open,
  onOpenChange,
  onEventCreated,
  defaultDate,
}: CalendarEventDialogProps) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setTitle("");
    setDescription("");
    setInstructions("");
    setError(null);
    setDateValue(format(defaultDate ?? new Date(), "yyyy-MM-dd"));
  }, [defaultDate, open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) {
      setError("You must be logged in to create an event.");
      return;
    }
    const eventName = title.trim();
    if (!eventName) {
      setError("Event name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startDate = new Date(`${dateValue}T12:00:00`);
      const prompt = `Promote the event "${eventName}" ${description ? `- ${description}` : ""} scheduled for ${dateValue}${instructions ? `. Important instructions: ${instructions}` : ""}. Create engaging promotional content that encourages attendance and builds excitement.`;

      const { error: insertError } = await supabase
        .from("campaigns")
        .insert({
          title: eventName,
          description: description.trim() || null,
          theme: `${eventName} Promotion`,
          prompt,
          start_date: dateValue,
          week_number: getISOWeek(startDate),
          source: "quick_action",
          user_id: user.id,
          created_by_user_id: user.id,
          ...(tenant?.id ? { tenant_id: tenant.id } : {}),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Campaign row exists — close the modal and notify the parent so the
      // calendar refreshes with the new email/SMS planning event.
      toast({
        title: "Event created",
        description: "The event is ready for email and SMS campaign planning.",
      });
      onEventCreated();
      onOpenChange(false);
    } catch (createError: any) {
      console.error("Error creating event:", createError);
      setError(createError.message || "Failed to create event");
    } finally {
      setLoading(false);
    }
  }

  return (
    <JoyDialog
      open={open}
      onClose={() => {
        if (!loading) onOpenChange(false);
      }}
      title="Create Event"
      description="Create a calendar event for coordinated email and SMS planning"
      size="md"
      startDecorator={<Sparkles size={18} />}
    >
      <JoyDialogContent>
        <Stack component="form" spacing={1.25} onSubmit={handleSubmit}>
          {error ? <Alert color="danger">{error}</Alert> : null}

          <Stack spacing={0.5}>
            <Typography
              level="body-xs"
              textTransform="uppercase"
              fontWeight="lg"
              color="neutral"
            >
              Event Name
            </Typography>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
            />
          </Stack>

          <Stack spacing={0.5}>
            <Typography
              level="body-xs"
              textTransform="uppercase"
              fontWeight="lg"
              color="neutral"
            >
              Event Date
            </Typography>
            <Input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              disabled={loading}
            />
          </Stack>

          <Stack spacing={0.5}>
            <Typography
              level="body-xs"
              textTransform="uppercase"
              fontWeight="lg"
              color="neutral"
            >
              Description
            </Typography>
            <Textarea
              minRows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </Stack>

          <Stack spacing={0.5}>
            <Typography
              level="body-xs"
              textTransform="uppercase"
              fontWeight="lg"
              color="neutral"
            >
              Instructions
            </Typography>
            <Textarea
              minRows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              disabled={loading}
            />
          </Stack>

          <JoyDialogActions sx={{ px: 0 }}>
            <JoyButton
              color="neutral"
              bloomVariant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </JoyButton>
            <JoyButton
              type="submit"
              color="primary"
              loading={loading}
              startDecorator={<Sparkles size={14} />}
            >
              Create Event
            </JoyButton>
          </JoyDialogActions>
        </Stack>
      </JoyDialogContent>
    </JoyDialog>
  );
}
