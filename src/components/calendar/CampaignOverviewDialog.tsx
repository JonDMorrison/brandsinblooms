import React, { useEffect, useState } from "react";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Calendar, ExternalLink, FileText, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip, JoyStatusChip } from "@/components/joy/JoyChip";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { applyTenantUserScope } from "@/utils/tenantScope";

interface CampaignOverviewDialogProps {
  campaign: any | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenCampaign?: (campaign: any) => void;
}

export function CampaignOverviewDialog({
  campaign,
  isOpen,
  onClose,
  onOpenCampaign,
}: CampaignOverviewDialogProps) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !campaign) return;

    void loadTasks();
  }, [campaign, isOpen]);

  async function loadTasks() {
    if (!campaign || !user) {
      setTasks([]);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from("content_tasks")
        .select("id, post_type, status, ai_output, scheduled_date")
        .eq("campaign_id", String(campaign.id))
        .order("scheduled_date", { ascending: true });

      query = applyTenantUserScope(query, {
        tenantId: tenant?.id,
        userId: user.id,
      });

      const { data, error } = await query;

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error loading campaign tasks:", error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  if (!campaign) {
    return null;
  }

  return (
    <JoyDialog
      open={isOpen}
      onClose={() => onClose()}
      title={campaign.title}
      description={
        campaign.theme || campaign.description || "Campaign overview"
      }
      size="lg"
      startDecorator={<TrendingUp size={18} />}
    >
      <JoyDialogContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <JoyChip color="success" variant="soft">
              Campaign
            </JoyChip>
            {campaign.start_date ? (
              <JoyChip color="neutral" variant="soft">
                Starts {format(new Date(campaign.start_date), "MMM d, yyyy")}
              </JoyChip>
            ) : null}
            {campaign.week_number ? (
              <JoyChip color="neutral" variant="soft">
                Week {campaign.week_number}
              </JoyChip>
            ) : null}
          </Stack>

          <Sheet
            variant="soft"
            color="success"
            sx={{ borderRadius: "lg", p: 1.5 }}
          >
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Calendar size={14} />
                <Typography level="body-sm">
                  {campaign.start_date
                    ? format(
                        new Date(campaign.start_date),
                        "EEEE, MMMM d, yyyy",
                      )
                    : "No start date"}
                </Typography>
              </Stack>
              {campaign.theme ? (
                <Typography level="body-sm">Theme: {campaign.theme}</Typography>
              ) : null}
              {campaign.description ? (
                <Typography level="body-sm">{campaign.description}</Typography>
              ) : null}
            </Stack>
          </Sheet>

          <Divider />

          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1} alignItems="center">
              <FileText size={16} />
              <Typography level="title-sm">Associated Tasks</Typography>
            </Stack>

            {loading ? (
              <Typography level="body-sm" color="neutral">
                Loading tasks...
              </Typography>
            ) : tasks.length > 0 ? (
              <Stack spacing={1}>
                {tasks.map((task) => (
                  <Sheet
                    key={task.id}
                    variant="outlined"
                    sx={{ borderRadius: "lg", p: 1.25 }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={0.75}
                      justifyContent="space-between"
                    >
                      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                        <Typography level="body-sm" fontWeight="lg">
                          {task.ai_output
                            ? String(task.ai_output).slice(0, 100)
                            : `${task.post_type} task`}
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          useFlexGap
                          flexWrap="wrap"
                        >
                          <JoyChip color="warning" variant="soft">
                            {task.post_type}
                          </JoyChip>
                          <JoyStatusChip status={task.status} />
                        </Stack>
                      </Stack>
                      {task.scheduled_date ? (
                        <Typography level="body-xs" color="neutral">
                          {format(new Date(task.scheduled_date), "MMM d")}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Sheet>
                ))}
              </Stack>
            ) : (
              <Typography level="body-sm" color="neutral">
                No tasks have been generated for this campaign yet.
              </Typography>
            )}
          </Stack>
        </Stack>
      </JoyDialogContent>
      <JoyDialogActions>
        <JoyButton
          bloomVariant="ghost"
          color="neutral"
          onClick={() => onClose()}
        >
          Close
        </JoyButton>
        {onOpenCampaign ? (
          <JoyButton
            color="primary"
            startDecorator={<ExternalLink size={14} />}
            onClick={() => onOpenCampaign(campaign)}
          >
            Open Campaign
          </JoyButton>
        ) : null}
      </JoyDialogActions>
    </JoyDialog>
  );
}
