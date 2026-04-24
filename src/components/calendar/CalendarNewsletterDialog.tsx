import React, { useEffect, useState } from "react";
import Input from "@mui/joy/Input";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { Mail } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { JoyChip } from "@/components/joy/JoyChip";
import { sanitizeCampaignTitle } from "@/utils/weekNumberSanitizer";

interface Segment {
  id: string;
  name: string;
  customer_count: number;
}

interface CalendarNewsletterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedDate?: Date | null;
  existingNewsletter?: any;
  mode: "create" | "edit";
}

export function CalendarNewsletterDialog({
  isOpen,
  onClose,
  onSuccess,
  selectedDate,
  existingNewsletter,
  mode,
}: CalendarNewsletterDialogProps) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [loading, setLoading] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    subject_line: "",
    preheader_text: "",
    segment_id: "",
    schedule_date: selectedDate || new Date(),
    schedule_time: "09:00",
  });

  useEffect(() => {
    if (!isOpen) return;

    void loadSegments();

    if (mode === "edit" && existingNewsletter) {
      const scheduledAt = existingNewsletter.scheduled_at
        ? new Date(existingNewsletter.scheduled_at)
        : new Date();

      setFormData({
        name: sanitizeCampaignTitle(existingNewsletter.name || ""),
        subject_line: existingNewsletter.subject_line || "",
        preheader_text: existingNewsletter.preheader_text || "",
        segment_id: existingNewsletter.segment_id || "",
        schedule_date: scheduledAt,
        schedule_time: format(scheduledAt, "HH:mm"),
      });
      return;
    }

    setFormData({
      name: "",
      subject_line: "",
      preheader_text: "",
      segment_id: "",
      schedule_date: selectedDate || new Date(),
      schedule_time: "09:00",
    });
  }, [existingNewsletter, isOpen, mode, selectedDate]);

  async function loadSegments() {
    try {
      if (!tenant?.id) {
        setSegments([]);
        return;
      }

      const { data } = await supabase
        .from("crm_segments")
        .select("id, name, customer_count")
        .eq("tenant_id", tenant.id)
        .order("name");

      setSegments(data || []);
    } catch (error) {
      console.error("Error loading newsletter segments:", error);
    }
  }

  async function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    setLoading(true);

    try {
      if (!user) {
        throw new Error("Not authenticated");
      }

      if (!tenant?.id) {
        throw new Error("No tenant found");
      }

      const scheduledAt = new Date(formData.schedule_date);
      const [hours, minutes] = formData.schedule_time.split(":");
      scheduledAt.setHours(Number(hours), Number(minutes), 0, 0);

      const payload = {
        tenant_id: tenant.id,
        user_id: user.id,
        name: formData.name,
        subject_line: formData.subject_line,
        preheader_text: formData.preheader_text,
        segment_id: formData.segment_id || null,
        scheduled_at: scheduledAt.toISOString(),
        status: "scheduled",
        delivery_method: "custom_domain",
      };

      if (mode === "edit" && existingNewsletter) {
        const { error } = await supabase
          .from("crm_campaigns")
          .update(payload)
          .eq("id", existingNewsletter.id)
          .eq("tenant_id", tenant.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("crm_campaigns")
          .insert([payload]);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving newsletter:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!existingNewsletter || !tenant?.id) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("crm_campaigns")
        .delete()
        .eq("id", existingNewsletter.id)
        .eq("tenant_id", tenant.id);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error deleting newsletter:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <JoyDialog
      open={isOpen}
      onClose={() => onClose()}
      title={mode === "edit" ? "Edit Newsletter" : "Schedule Newsletter"}
      description="Plan timing, audience, and messaging for this email send"
      size="md"
      startDecorator={<Mail size={18} />}
    >
      <JoyDialogContent>
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <Stack spacing={0.75}>
              <Typography
                level="body-xs"
                textTransform="uppercase"
                fontWeight="lg"
                color="neutral"
              >
                Newsletter Name
              </Typography>
              <Input
                value={formData.name}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    name: sanitizeCampaignTitle(event.target.value),
                  }))
                }
                placeholder="Weekend garden offers"
                required
              />
            </Stack>

            <Stack spacing={0.75}>
              <Typography
                level="body-xs"
                textTransform="uppercase"
                fontWeight="lg"
                color="neutral"
              >
                Subject Line
              </Typography>
              <Input
                value={formData.subject_line}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    subject_line: event.target.value,
                  }))
                }
                placeholder="Fresh ideas for this weekend in the garden"
                required
              />
            </Stack>

            <Stack spacing={0.75}>
              <Typography
                level="body-xs"
                textTransform="uppercase"
                fontWeight="lg"
                color="neutral"
              >
                Preheader
              </Typography>
              <Textarea
                minRows={3}
                value={formData.preheader_text}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    preheader_text: event.target.value,
                  }))
                }
                placeholder="Add the short preview text customers see next to the subject"
              />
            </Stack>

            <Stack spacing={0.75}>
              <Typography
                level="body-xs"
                textTransform="uppercase"
                fontWeight="lg"
                color="neutral"
              >
                Audience Segment
              </Typography>
              <Select
                value={formData.segment_id || "all"}
                onChange={(_event, value) =>
                  setFormData((current) => ({
                    ...current,
                    segment_id: value === "all" ? "" : String(value),
                  }))
                }
              >
                <Option value="all">All Customers</Option>
                {segments.map((segment) => (
                  <Option key={segment.id} value={segment.id}>
                    {segment.name} ({segment.customer_count})
                  </Option>
                ))}
              </Select>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
              <Stack spacing={0.75} sx={{ flex: 1 }}>
                <Typography
                  level="body-xs"
                  textTransform="uppercase"
                  fontWeight="lg"
                  color="neutral"
                >
                  Send Date
                </Typography>
                <Input
                  type="date"
                  value={format(formData.schedule_date, "yyyy-MM-dd")}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      schedule_date: event.target.value
                        ? new Date(event.target.value)
                        : new Date(),
                    }))
                  }
                />
              </Stack>

              <Stack spacing={0.75} sx={{ flex: 1 }}>
                <Typography
                  level="body-xs"
                  textTransform="uppercase"
                  fontWeight="lg"
                  color="neutral"
                >
                  Send Time
                </Typography>
                <Input
                  type="time"
                  value={formData.schedule_time}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      schedule_time: event.target.value,
                    }))
                  }
                />
              </Stack>
            </Stack>

            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <JoyChip color="info" variant="soft">
                Delivery via custom domain
              </JoyChip>
              {mode === "edit" && existingNewsletter?.status ? (
                <JoyChip color="neutral" variant="soft">
                  Status: {existingNewsletter.status}
                </JoyChip>
              ) : null}
            </Stack>
          </Stack>
        </form>
      </JoyDialogContent>
      <JoyDialogActions>
        {mode === "edit" ? (
          <JoyButton
            color="danger"
            bloomVariant="outline"
            loading={loading}
            onClick={handleDelete}
          >
            Delete
          </JoyButton>
        ) : null}
        <JoyButton
          bloomVariant="ghost"
          color="neutral"
          onClick={() => onClose()}
        >
          Cancel
        </JoyButton>
        <JoyButton
          color="primary"
          loading={loading}
          onClick={() => void handleSubmit()}
        >
          {mode === "edit" ? "Save Changes" : "Schedule Newsletter"}
        </JoyButton>
      </JoyDialogActions>
    </JoyDialog>
  );
}
