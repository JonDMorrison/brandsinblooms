import LinearProgress from "@mui/joy/LinearProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Workflow } from "lucide-react";
import { JoyCard, JoyCardContent, JoyCardHeader } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { useCustomerAutomationRuns } from "@/hooks/useCustomerAutomationRuns";
import { formatDateLabel } from "./customerDashboardUtils";

interface CustomerAutomationsCardProps {
  customerId: string;
}

const statusVariant = (status: string) => {
  if (["active", "running", "waiting", "scheduled"].includes(status)) {
    return "info" as const;
  }
  if (status === "completed") return "success" as const;
  if (["failed", "cancelled", "canceled"].includes(status)) {
    return "danger" as const;
  }
  return "neutral" as const;
};

const formatStatus = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function CustomerAutomationsCard({
  customerId,
}: CustomerAutomationsCardProps) {
  const runs = useCustomerAutomationRuns(customerId);

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Automations"
        description="Current and recent customer journeys, including the next scheduled step and any failure."
        startDecorator={<Workflow size={18} />}
      />
      <JoyCardContent>
        {runs.isLoading ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}
        {runs.isError ? (
          <Typography level="body-sm" color="danger">
            Automation activity could not be loaded.
          </Typography>
        ) : null}
        {!runs.isLoading && !runs.isError && !runs.data?.length ? (
          <Typography level="body-sm" color="neutral">
            This customer has not entered an automation yet.
          </Typography>
        ) : null}
        {runs.data?.length ? (
          <Stack spacing={1.5}>
            {runs.data.map((run) => {
              const completedSteps = Math.min(
                Math.max(run.current_step_index, 0),
                Math.max(run.total_steps, 0),
              );
              const progress =
                run.total_steps > 0
                  ? Math.round((completedSteps / run.total_steps) * 100)
                  : 0;

              return (
                <Stack key={run.id} spacing={0.75}>
                  <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                      <Typography level="title-sm">
                        {run.automation?.name ?? "Deleted automation"}
                      </Typography>
                      <Typography level="body-xs" color="neutral">
                        Started {formatDateLabel(run.started_at)}
                        {run.next_step_scheduled_at
                          ? ` · Next step ${formatDateLabel(run.next_step_scheduled_at)}`
                          : ""}
                      </Typography>
                    </Stack>
                    <JoyChip bloomVariant={statusVariant(run.status)} size="sm">
                      {formatStatus(run.status)}
                    </JoyChip>
                  </Stack>
                  {run.total_steps > 0 ? (
                    <Stack spacing={0.25}>
                      <LinearProgress determinate value={progress} sx={{ borderRadius: 999 }} />
                      <Typography level="body-xs" color="neutral">
                        Step {completedSteps} of {run.total_steps}
                      </Typography>
                    </Stack>
                  ) : null}
                  {run.error_message ? (
                    <Typography level="body-xs" color="danger">
                      {run.error_message}
                    </Typography>
                  ) : null}
                </Stack>
              );
            })}
          </Stack>
        ) : null}
      </JoyCardContent>
    </JoyCard>
  );
}
