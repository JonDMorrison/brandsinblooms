import * as React from "react";
import Breadcrumbs from "@mui/joy/Breadcrumbs";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Link from "@mui/joy/Link";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Typography from "@mui/joy/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Circle,
  Copy,
  Edit3,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import { PageContainer } from "@/components/joy/PageContainer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

const MOUNT_SKELETON_MS = 260;

type SMSAutomationRecord = {
  created_at: string;
  description: string | null;
  flow: unknown;
  id: string;
  name: string;
  status: string | null;
  tenant_id: string | null;
  trigger_config: Record<string, unknown> | null;
  trigger_type: string;
  updated_at: string;
  user_id: string;
};

type AutomationStatsMap = Record<string, { sent: number; failed: number }>;

function getFlowSteps(flow: unknown) {
  if (Array.isArray(flow)) {
    return flow;
  }

  if (
    flow &&
    typeof flow === "object" &&
    Array.isArray((flow as { steps?: unknown[] }).steps)
  ) {
    return (flow as { steps: unknown[] }).steps;
  }

  return [];
}

function getTriggerPresentation(triggerType: string) {
  switch (triggerType) {
    case "signup":
      return {
        title: "New Customer",
        description: "Triggers when a new customer is created.",
      };
    case "purchase":
      return {
        title: "Purchase Complete",
        description: "Triggers after a completed purchase.",
      };
    case "abandoned_cart":
      return {
        title: "Abandoned Cart",
        description: "Triggers when a cart is left behind.",
      };
    case "birthday":
      return {
        title: "Birthday",
        description: "Triggers on the customer birthday date.",
      };
    case "manual":
      return {
        title: "Manual Trigger",
        description: "Runs when staff manually starts the sequence.",
      };
    default:
      return {
        title: triggerType || "Unknown Trigger",
        description: "Triggers when the configured SMS event fires.",
      };
  }
}

function DashboardSkeleton() {
  return (
    <Stack spacing={2.5}>
      <Stack spacing={1.25}>
        <Skeleton variant="text" sx={{ width: 160, height: 16 }} />
        <Skeleton variant="text" sx={{ width: 240, height: 32 }} />
        <Skeleton variant="text" sx={{ width: 420, height: 18 }} />
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 2,
        }}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <Card
            key={index}
            variant="outlined"
            sx={{ borderRadius: "26px", p: 2.5, borderColor: "neutral.200" }}
          >
            <Stack spacing={2.25}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
              >
                <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
                  <Skeleton variant="text" sx={{ width: "72%", height: 18 }} />
                  <Skeleton variant="text" sx={{ width: "88%", height: 14 }} />
                </Stack>
                <Skeleton
                  variant="rectangular"
                  sx={{ width: 40, height: 24, borderRadius: "999px" }}
                />
              </Stack>
              <Skeleton
                variant="rectangular"
                sx={{ width: "100%", height: 88, borderRadius: "18px" }}
              />
              <Stack direction="row" spacing={2}>
                <Skeleton variant="text" sx={{ width: 72, height: 14 }} />
                <Skeleton variant="text" sx={{ width: 72, height: 14 }} />
              </Stack>
            </Stack>
          </Card>
        ))}
      </Box>
    </Stack>
  );
}

export default function SMSAutomationDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [showMountSkeleton, setShowMountSkeleton] = React.useState(true);
  const [automationToDelete, setAutomationToDelete] =
    React.useState<SMSAutomationRecord | null>(null);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setShowMountSkeleton(false);
    }, MOUNT_SKELETON_MS);

    return () => window.clearTimeout(timeout);
  }, []);

  const automationsQuery = useQuery({
    queryKey: ["sms-automations", tenant?.id],
    queryFn: async (): Promise<SMSAutomationRecord[]> => {
      if (!user || !tenant) {
        return [];
      }

      const { data, error } = await supabase
        .from("sms_automations")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []) as SMSAutomationRecord[];
    },
    enabled: Boolean(user && tenant),
  });

  const logStatsQuery = useQuery({
    queryKey: [
      "sms-automation-log-stats",
      automationsQuery.data?.map((automation) => automation.id).join(":") ||
        "none",
    ],
    enabled: Boolean(automationsQuery.data?.length),
    queryFn: async (): Promise<AutomationStatsMap> => {
      const automationIds =
        automationsQuery.data?.map((automation) => automation.id) || [];
      if (!automationIds.length) {
        return {};
      }

      const { data, error } = await supabase
        .from("sms_automation_logs")
        .select("automation_id, status")
        .in("automation_id", automationIds);

      if (error) {
        throw error;
      }

      return (data || []).reduce<AutomationStatsMap>((accumulator, entry) => {
        const automationId = entry.automation_id;
        if (!automationId) {
          return accumulator;
        }

        accumulator[automationId] ||= { sent: 0, failed: 0 };

        if (entry.status === "sent") {
          accumulator[automationId].sent += 1;
        }

        if (entry.status === "failed") {
          accumulator[automationId].failed += 1;
        }

        return accumulator;
      }, {});
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({
      automation,
      checked,
    }: {
      automation: SMSAutomationRecord;
      checked: boolean;
    }) => {
      const nextStatus = checked
        ? "active"
        : automation.status === "draft"
          ? "draft"
          : "paused";

      const { error } = await supabase
        .from("sms_automations")
        .update({ status: nextStatus })
        .eq("id", automation.id)
        .eq("tenant_id", tenant?.id || "");

      if (error) {
        throw error;
      }

      return nextStatus;
    },
    onSuccess: (nextStatus) => {
      toast.success(
        nextStatus === "active"
          ? "Automation activated"
          : nextStatus === "paused"
            ? "Automation paused"
            : "Automation saved as draft",
      );
      void queryClient.invalidateQueries({
        queryKey: ["sms-automations", tenant?.id],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update automation status",
      );
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (automation: SMSAutomationRecord) => {
      const { error } = await supabase.from("sms_automations").insert({
        tenant_id: automation.tenant_id,
        user_id: automation.user_id,
        name: `${automation.name} Copy`,
        description: automation.description,
        trigger_type: automation.trigger_type,
        trigger_config: automation.trigger_config || {},
        flow: automation.flow,
        status: "draft",
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Automation duplicated");
      void queryClient.invalidateQueries({
        queryKey: ["sms-automations", tenant?.id],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to duplicate automation",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (automation: SMSAutomationRecord) => {
      const { error } = await supabase
        .from("sms_automations")
        .delete()
        .eq("id", automation.id)
        .eq("tenant_id", tenant?.id || "");

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Automation deleted");
      setAutomationToDelete(null);
      void queryClient.invalidateQueries({
        queryKey: ["sms-automations", tenant?.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["sms-automation-log-stats"],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete automation",
      );
    },
  });

  const shouldShowSkeleton = automationsQuery.isLoading || showMountSkeleton;
  const automations = automationsQuery.data || [];

  return (
    <>
      <PageContainer fullWidth sx={{ py: 3 }}>
        <Stack spacing={2.5}>
          {shouldShowSkeleton ? (
            <DashboardSkeleton />
          ) : (
            <>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                justifyContent="space-between"
                alignItems={{ md: "flex-start" }}
              >
                <Stack spacing={1.25}>
                  <Breadcrumbs separator="/" size="sm">
                    <Link
                      component={RouterLink}
                      to="/sms"
                      color="neutral"
                      underline="hover"
                    >
                      SMS Campaigns
                    </Link>
                    <Typography level="body-sm" color="neutral">
                      Automations
                    </Typography>
                  </Breadcrumbs>

                  <Stack spacing={0.5}>
                    <Typography level="h3" fontWeight="lg">
                      SMS Automations
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      Set up automated SMS workflows triggered by customer
                      actions
                    </Typography>
                  </Stack>
                </Stack>

                <Button
                  variant="solid"
                  startDecorator={<Plus size={16} />}
                  onClick={() => navigate("/sms/automations/new")}
                  sx={{ borderRadius: "12px" }}
                >
                  New Automation
                </Button>
              </Stack>

              {automations.length === 0 ? (
                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: "30px",
                    borderColor: "neutral.200",
                    minHeight: 540,
                    display: "grid",
                    placeItems: "center",
                    px: 3,
                    py: 8,
                    textAlign: "center",
                  }}
                >
                  <Stack
                    spacing={2.5}
                    alignItems="center"
                    sx={{ maxWidth: 440 }}
                  >
                    <Box
                      sx={{
                        width: 88,
                        height: 88,
                        borderRadius: "28px",
                        display: "grid",
                        placeItems: "center",
                        color: "neutral.500",
                        bgcolor:
                          "rgba(var(--joy-palette-neutral-mainChannel) / 0.08)",
                      }}
                    >
                      <Bot size={34} />
                    </Box>
                    <Stack spacing={0.75}>
                      <Typography level="title-lg">
                        No automations yet
                      </Typography>
                      <Typography level="body-sm" color="neutral">
                        Create automated SMS workflows to engage customers at
                        the right moment
                      </Typography>
                    </Stack>
                    <Button
                      variant="solid"
                      startDecorator={<Plus size={16} />}
                      onClick={() => navigate("/sms/automations/new")}
                      sx={{ borderRadius: "12px" }}
                    >
                      Create Automation
                    </Button>
                  </Stack>
                </Card>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(340px, 1fr))",
                    gap: 2,
                  }}
                >
                  {automations.map((automation) => {
                    const trigger = getTriggerPresentation(
                      automation.trigger_type,
                    );
                    const flowSteps = getFlowSteps(automation.flow);
                    const stats = logStatsQuery.data?.[automation.id] || {
                      sent: 0,
                      failed: 0,
                    };
                    const isActive = automation.status === "active";

                    return (
                      <Card
                        key={automation.id}
                        variant="outlined"
                        sx={{
                          borderRadius: "26px",
                          borderColor: "neutral.200",
                          p: 2.5,
                          transition:
                            "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
                          "&:hover": {
                            borderColor: "primary.300",
                            boxShadow: "md",
                            transform: "translateY(-2px)",
                          },
                        }}
                      >
                        <Stack spacing={2.5} sx={{ height: "100%" }}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            spacing={1.5}
                            alignItems="flex-start"
                          >
                            <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                              <Typography level="title-md" fontWeight="lg">
                                {automation.name}
                              </Typography>
                              <Typography level="body-sm" color="neutral">
                                {trigger.description}
                              </Typography>
                            </Stack>

                            <Stack
                              direction="row"
                              spacing={0.75}
                              alignItems="center"
                            >
                              <Switch
                                size="sm"
                                color={isActive ? "success" : "neutral"}
                                checked={isActive}
                                onChange={(event) =>
                                  toggleStatusMutation.mutate({
                                    automation,
                                    checked: event.target.checked,
                                  })
                                }
                              />
                              <JoyDropdownMenu>
                                <JoyDropdownMenuTrigger
                                  aria-label={`Actions for ${automation.name}`}
                                >
                                  <MoreHorizontal size={16} />
                                </JoyDropdownMenuTrigger>
                                <JoyDropdownMenuContent>
                                  <JoyDropdownMenuItem
                                    startDecorator={<Edit3 size={16} />}
                                    onClick={() =>
                                      navigate(
                                        `/sms/automations/${automation.id}`,
                                      )
                                    }
                                  >
                                    Edit
                                  </JoyDropdownMenuItem>
                                  <JoyDropdownMenuItem
                                    startDecorator={<Copy size={16} />}
                                    onClick={() =>
                                      duplicateMutation.mutate(automation)
                                    }
                                  >
                                    Duplicate
                                  </JoyDropdownMenuItem>
                                  <JoyDropdownMenuItem
                                    startDecorator={<Trash2 size={16} />}
                                    destructive
                                    onClick={() =>
                                      setAutomationToDelete(automation)
                                    }
                                  >
                                    Delete
                                  </JoyDropdownMenuItem>
                                </JoyDropdownMenuContent>
                              </JoyDropdownMenu>
                            </Stack>
                          </Stack>

                          <Card
                            variant="soft"
                            color="neutral"
                            sx={{
                              borderRadius: "20px",
                              p: 1.75,
                              minHeight: 116,
                            }}
                          >
                            <Stack spacing={1}>
                              <Typography
                                level="body-xs"
                                color="neutral"
                                sx={{
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                }}
                              >
                                Trigger
                              </Typography>
                              <Typography level="body-sm" fontWeight="md">
                                {trigger.title}
                              </Typography>
                              <Typography level="body-xs" color="neutral">
                                {automation.description ||
                                  `${flowSteps.length} step${flowSteps.length === 1 ? "" : "s"} configured for this workflow.`}
                              </Typography>
                            </Stack>
                          </Card>

                          <Stack
                            direction="row"
                            spacing={2}
                            useFlexGap
                            flexWrap="wrap"
                            sx={{ mt: "auto" }}
                          >
                            <Stack
                              direction="row"
                              spacing={0.75}
                              alignItems="center"
                            >
                              <Circle
                                size={8}
                                fill="currentColor"
                                color="var(--joy-palette-success-500)"
                              />
                              <Typography level="body-xs" color="neutral">
                                {stats.sent} sent
                              </Typography>
                            </Stack>
                            <Stack
                              direction="row"
                              spacing={0.75}
                              alignItems="center"
                            >
                              <Circle
                                size={8}
                                fill="currentColor"
                                color="var(--joy-palette-danger-500)"
                              />
                              <Typography level="body-xs" color="neutral">
                                {stats.failed} failed
                              </Typography>
                            </Stack>
                          </Stack>
                        </Stack>
                      </Card>
                    );
                  })}
                </Box>
              )}
            </>
          )}
        </Stack>
      </PageContainer>

      <Modal
        open={Boolean(automationToDelete)}
        onClose={() => setAutomationToDelete(null)}
      >
        <ModalDialog sx={{ borderRadius: "24px", p: 3, minWidth: { sm: 420 } }}>
          <ModalClose />
          <Stack spacing={1.5}>
            <Typography level="title-lg">Delete automation?</Typography>
            <Typography level="body-sm" color="neutral">
              {automationToDelete
                ? `This will permanently delete ${automationToDelete.name}.`
                : "This automation will be permanently deleted."}
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="plain"
                color="neutral"
                onClick={() => setAutomationToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="solid"
                color="danger"
                loading={deleteMutation.isPending}
                onClick={() => {
                  if (automationToDelete) {
                    deleteMutation.mutate(automationToDelete);
                  }
                }}
              >
                Delete
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>
    </>
  );
}
