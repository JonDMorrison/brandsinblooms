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

interface CalendarCampaignCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated: () => void;
}

export function CalendarCampaignCreateDialog({
  open,
  onOpenChange,
  onCampaignCreated,
}: CalendarCampaignCreateDialogProps) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setTitle("");
    setTheme("");
    setDescription("");
    setDateValue(format(new Date(), "yyyy-MM-dd"));
    setError(null);
  }, [open]);

  const busy = loading;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) {
      setError("You must be logged in to create a campaign.");
      return;
    }
    if (!title.trim()) {
      setError("Campaign title is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startDate = new Date(`${dateValue}T12:00:00`);
      const prompt = `Plan an email and SMS campaign for \"${title.trim()}\" ${theme ? `with theme: ${theme}` : ""} ${description ? `- ${description}` : ""}.`;

      const { error: insertError } = await supabase
        .from("campaigns")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          theme: theme.trim() || null,
          prompt,
          start_date: dateValue,
          week_number: getISOWeek(startDate),
          source: "quick_action",
          user_id: user.id,
          created_by_user_id: user.id,
          ...(tenant?.id ? { tenant_id: tenant.id } : {}),
        });

      if (insertError) throw insertError;

      toast({
        title: "Campaign created",
        description: "The campaign is ready for email and SMS authoring.",
      });
      onCampaignCreated();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      setError(error.message || "Failed to create campaign");
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
      title="Create Campaign"
      description="Plan a coordinated email and SMS campaign"
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
              Campaign Title
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
              Theme
            </Typography>
            <Input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
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
              Start Date
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
              minRows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              startDecorator={<Sparkles size={14} />}
            >
              Create Campaign
            </JoyButton>
          </JoyDialogActions>
        </Stack>
      </JoyDialogContent>
    </JoyDialog>
  );
}
