import { useEffect, useState } from "react";
import Alert from "@mui/joy/Alert";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
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
import { generateCampaignContent } from "@/components/homepage/ContentGenerationServices";

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
  const [generating, setGenerating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setTitle("");
    setDescription("");
    setInstructions("");
    setError(null);
    setSuccess(false);
    setDateValue(format(defaultDate ?? new Date(), "yyyy-MM-dd"));
  }, [defaultDate, open]);

  const busy = loading || generating;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) {
      setError("You must be logged in to create an event.");
      return;
    }
    if (!title.trim()) {
      setError("Event name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startDate = new Date(`${dateValue}T12:00:00`);
      const prompt = `Promote the event "${title.trim()}" ${description ? `- ${description}` : ""} scheduled for ${dateValue}${instructions ? `. Important instructions: ${instructions}` : ""}. Create engaging promotional content that encourages attendance and builds excitement.`;

      const { data: insertedCampaign, error: insertError } = await supabase
        .from("campaigns")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          theme: `${title.trim()} Promotion`,
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

      setLoading(false);
      setGenerating(true);

      const result = await generateCampaignContent(
        insertedCampaign.id,
        insertedCampaign.theme || insertedCampaign.title,
        insertedCampaign.description || "",
        user.id,
        insertedCampaign.week_number,
        tenant?.id,
      );

      setGenerating(false);
      setSuccess(true);
      toast({
        title: "Event created",
        description: `Generated ${result.tasks?.length || 5} content pieces for this event.`,
      });
      onEventCreated();
      window.setTimeout(() => onOpenChange(false), 1200);
    } catch (error: any) {
      console.error("Error creating event:", error);
      setError(error.message || "Failed to create event");
      setGenerating(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <JoyDialog
      open={open}
      onClose={() => {
        if (!busy) onOpenChange(false);
      }}
      title="Create Event"
      description="Create a calendar event and generate a starter content pack"
      size="md"
      startDecorator={<Sparkles size={18} />}
    >
      <JoyDialogContent>
        <Stack component="form" spacing={1.25} onSubmit={handleSubmit}>
          {error ? <Alert color="danger">{error}</Alert> : null}
          {success ? (
            <Alert color="success" startDecorator={<CheckCircle2 size={16} />}>
              Event created successfully.
            </Alert>
          ) : null}

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
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
            />
          </Stack>

          <JoyDialogActions sx={{ px: 0 }}>
            <JoyButton
              color="neutral"
              bloomVariant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </JoyButton>
            <JoyButton
              type="submit"
              color="primary"
              loading={busy}
              startDecorator={
                busy ? <Loader2 size={14} /> : <Sparkles size={14} />
              }
            >
              {generating ? "Generating Content" : "Create Event"}
            </JoyButton>
          </JoyDialogActions>
        </Stack>
      </JoyDialogContent>
    </JoyDialog>
  );
}
