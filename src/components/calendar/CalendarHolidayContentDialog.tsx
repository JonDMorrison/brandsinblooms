import React, { useEffect, useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import TabPanel from "@mui/joy/TabPanel";
import Tabs from "@mui/joy/Tabs";
import Typography from "@mui/joy/Typography";
import { FileText, Sparkles } from "lucide-react";
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

interface CalendarHolidayContentDialogProps {
  holidayId: string;
  holidayName: string;
  isOpen: boolean;
  onClose: () => void;
  onGenerate?: () => void;
}

export function CalendarHolidayContentDialog({
  holidayId,
  holidayName,
  isOpen,
  onClose,
  onGenerate,
}: CalendarHolidayContentDialogProps) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !holidayId) return;

    void loadTasks();
  }, [holidayId, isOpen]);

  async function loadTasks() {
    if (!user) {
      setTasks([]);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from("content_tasks")
        .select("id, post_type, status, ai_output, scheduled_date")
        .eq("holiday_id", holidayId)
        .order("scheduled_date", { ascending: true });

      query = applyTenantUserScope(query, {
        tenantId: tenant?.id,
        userId: user.id,
      });

      const { data, error } = await query;

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error loading holiday tasks:", error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  const groupedTasks = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const task of tasks) {
      const key = task.post_type || "other";
      const existing = groups.get(key) || [];
      existing.push(task);
      groups.set(key, existing);
    }
    return Array.from(groups.entries());
  }, [tasks]);

  return (
    <JoyDialog
      open={isOpen}
      onClose={() => onClose()}
      title={holidayName || "Holiday content"}
      description="Generated content connected to this holiday"
      size="xl"
      startDecorator={<Sparkles size={18} />}
    >
      <JoyDialogContent>
        {loading ? (
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{ minHeight: 240 }}
          >
            <CircularProgress size="lg" />
          </Stack>
        ) : tasks.length === 0 ? (
          <Stack
            spacing={2}
            alignItems="center"
            sx={{ py: 4, textAlign: "center" }}
          >
            <FileText size={28} />
            <Typography level="title-md">No holiday content yet</Typography>
            <Typography level="body-sm" color="neutral">
              Generate the first set of holiday posts and newsletter tasks for
              this date.
            </Typography>
            {onGenerate ? (
              <JoyButton
                color="primary"
                startDecorator={<Sparkles size={14} />}
                onClick={() => onGenerate()}
              >
                Generate Holiday Content
              </JoyButton>
            ) : null}
          </Stack>
        ) : (
          <Stack spacing={2}>
            {tasks.some((task) => !task.ai_output) && onGenerate ? (
              <Alert color="warning" variant="soft">
                Some holiday tasks are missing generated content.
              </Alert>
            ) : null}

            <Tabs defaultValue={0}>
              <TabList>
                <Tab value={0}>All</Tab>
                {groupedTasks.map(([type], index) => (
                  <Tab key={type} value={index + 1}>
                    {type}
                  </Tab>
                ))}
              </TabList>

              <TabPanel value={0} sx={{ px: 0 }}>
                <Stack spacing={1}>
                  {tasks.map((task) => (
                    <HolidayTaskCard key={task.id} task={task} />
                  ))}
                </Stack>
              </TabPanel>

              {groupedTasks.map(([type, items], index) => (
                <TabPanel key={type} value={index + 1} sx={{ px: 0 }}>
                  <Stack spacing={1}>
                    {items.map((task) => (
                      <HolidayTaskCard key={task.id} task={task} />
                    ))}
                  </Stack>
                </TabPanel>
              ))}
            </Tabs>
          </Stack>
        )}
      </JoyDialogContent>
      <JoyDialogActions>
        <JoyButton
          color="neutral"
          bloomVariant="ghost"
          onClick={() => onClose()}
        >
          Close
        </JoyButton>
        {tasks.some((task) => !task.ai_output) && onGenerate ? (
          <JoyButton
            color="primary"
            startDecorator={<Sparkles size={14} />}
            onClick={() => onGenerate()}
          >
            Generate Missing Content
          </JoyButton>
        ) : null}
      </JoyDialogActions>
    </JoyDialog>
  );
}

function HolidayTaskCard({ task }: { task: any }) {
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 1.5 }}>
      <Stack spacing={1}>
        <Stack
          direction="row"
          spacing={0.75}
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <JoyChip color="warning" variant="soft">
              {task.post_type}
            </JoyChip>
            <JoyStatusChip status={task.status} />
          </Stack>
          {task.scheduled_date ? (
            <Typography level="body-xs" color="neutral">
              {format(new Date(task.scheduled_date), "MMM d")}
            </Typography>
          ) : null}
        </Stack>
        <Divider />
        <Typography
          level="body-sm"
          sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}
        >
          {task.ai_output || "No AI content generated yet."}
        </Typography>
      </Stack>
    </Sheet>
  );
}
