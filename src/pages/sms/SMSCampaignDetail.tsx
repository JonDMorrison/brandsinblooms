import * as React from "react";
import Alert from "@mui/joy/Alert";
import Breadcrumbs from "@mui/joy/Breadcrumbs";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Link from "@mui/joy/Link";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  MessageSquareText,
  ShieldAlert,
  TimerReset,
  Users,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { PageContainer } from "@/components/joy/PageContainer";
import { SmsCampaignActions } from "@/components/sms/SmsCampaignActions";
import { SmsCampaignProgressCard } from "@/components/sms/SmsCampaignProgressCard";
import { useSmsCampaignProgress } from "@/hooks/useSmsCampaignProgress";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 20;
const MOUNT_SKELETON_MS = 260;

type MetricsShape = {
  sent?: number;
  delivered?: number;
  clicked?: number;
  failed?: number;
  opt_outs?: number;
  revenue?: number;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getStatusChip(status: string) {
  switch (status) {
    case "sent":
      return { color: "success" as const, label: "Sent" };
    case "sending":
      return { color: "primary" as const, label: "Sending" };
    case "scheduled":
      return { color: "warning" as const, label: "Scheduled" };
    case "draft":
      return { color: "neutral" as const, label: "Draft" };
    case "failed":
      return { color: "danger" as const, label: "Failed" };
    case "queued":
      return { color: "warning" as const, label: "Queued" };
    case "paused":
      return { color: "warning" as const, label: "Paused" };
    default:
      return {
        color: "neutral" as const,
        label: status
          ? `${status.charAt(0).toUpperCase()}${status.slice(1)}`
          : "Unknown",
      };
  }
}

function getMessageStatusChip(status: string | null) {
  switch (status) {
    case "delivered":
      return { color: "success" as const, label: "Delivered" };
    case "sent":
      return { color: "primary" as const, label: "Sent" };
    case "failed":
      return { color: "danger" as const, label: "Failed" };
    case "queued":
      return { color: "warning" as const, label: "Queued" };
    default:
      return { color: "neutral" as const, label: status || "Unknown" };
  }
}

function DetailSkeleton() {
  return (
    <PageContainer fullWidth sx={{ py: 3 }}>
      <Stack spacing={2.5}>
        <Card
          variant="outlined"
          sx={{ borderRadius: "28px", borderColor: "neutral.200", p: 3 }}
        >
          <Stack spacing={1.25}>
            <Skeleton variant="text" sx={{ width: 220, height: 16 }} />
            <Skeleton variant="text" sx={{ width: 420, height: 32 }} />
            <Skeleton variant="text" sx={{ width: 520, height: 18 }} />
          </Stack>
        </Card>

        <Skeleton
          variant="rectangular"
          sx={{ height: 320, borderRadius: "30px" }}
        />

        <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5}>
          <Stack spacing={2.5} sx={{ flex: 1 }}>
            <Skeleton
              variant="rectangular"
              sx={{ height: 360, borderRadius: "28px" }}
            />
            <Skeleton
              variant="rectangular"
              sx={{ height: 420, borderRadius: "28px" }}
            />
          </Stack>
          <Stack spacing={2.5} sx={{ width: { lg: 360 } }}>
            <Skeleton
              variant="rectangular"
              sx={{ height: 280, borderRadius: "28px" }}
            />
            <Skeleton
              variant="rectangular"
              sx={{ height: 220, borderRadius: "28px" }}
            />
          </Stack>
        </Stack>
      </Stack>
    </PageContainer>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  color = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  color?: "neutral" | "primary" | "success" | "warning" | "danger";
}) {
  return (
    <Card variant="soft" color={color} sx={{ borderRadius: "24px", p: 2 }}>
      <Stack spacing={1.25}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography level="body-sm" color="neutral">
            {label}
          </Typography>
          <BoxIcon>{icon}</BoxIcon>
        </Stack>
        <Typography
          level="h2"
          sx={{ fontWeight: 700, letterSpacing: "-0.03em" }}
        >
          {value}
        </Typography>
        <Typography level="body-xs" color="neutral">
          {detail}
        </Typography>
      </Stack>
    </Card>
  );
}

function BoxIcon({ children }: { children: React.ReactNode }) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        width: 34,
        height: 34,
        borderRadius: "12px",
        display: "grid",
        placeItems: "center",
        borderColor: "rgba(15, 23, 42, 0.08)",
      }}
    >
      {children}
    </Sheet>
  );
}

export default function SMSCampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [showMountSkeleton, setShowMountSkeleton] = React.useState(true);
  const [showContent, setShowContent] = React.useState(false);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setShowMountSkeleton(false);
    }, MOUNT_SKELETON_MS);

    return () => window.clearTimeout(timeout);
  }, []);

  const campaignQuery = useQuery({
    queryKey: ["sms-campaign", id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) {
        return null;
      }

      const { data, error } = await supabase
        .from("crm_sms_campaigns")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
  });

  const messagesQuery = useQuery({
    queryKey: ["sms-campaign-messages", id, page],
    enabled: Boolean(id),
    staleTime: 10_000,
    queryFn: async () => {
      if (!id) {
        return { items: [], count: 0 };
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("sms_messages")
        .select(
          "id, phone, content, status, created_at, sent_at, delivered_at, from_phone, error_message, error_code, media_urls",
          { count: "exact" },
        )
        .eq("campaign_id", id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        throw error;
      }

      return {
        items: (data || []).map((message) => ({
          ...message,
          status: message.status || "queued",
          media_urls: Array.isArray(message.media_urls)
            ? message.media_urls.filter(
                (item): item is string => typeof item === "string",
              )
            : [],
        })),
        count: count || 0,
      };
    },
  });

  const campaign = campaignQuery.data;
  const showProgress = Boolean(
    campaign &&
    ["queued", "sending", "sent", "failed", "paused"].includes(campaign.status),
  );

  const {
    data: progress,
    loading: progressLoading,
    error: progressError,
  } = useSmsCampaignProgress({
    campaignId: id,
    enabled: Boolean(id) && showProgress,
    pollIntervalMs: 3000,
  });

  const detailLoading = showMountSkeleton || campaignQuery.isLoading;

  React.useEffect(() => {
    if (detailLoading) {
      setShowContent(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => setShowContent(true));
    return () => window.cancelAnimationFrame(frame);
  }, [detailLoading]);

  const invalidateDetail = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sms-campaign", id] }),
      queryClient.invalidateQueries({
        queryKey: ["sms-campaign-messages", id],
      }),
    ]);
  }, [id, queryClient]);

  if (detailLoading) {
    return <DetailSkeleton />;
  }

  if (campaignQuery.error) {
    return (
      <PageContainer fullWidth sx={{ py: 3 }}>
        <Card
          variant="outlined"
          sx={{ borderRadius: "28px", borderColor: "danger.200", p: 3 }}
        >
          <Alert
            color="danger"
            variant="soft"
            sx={{ borderRadius: "18px", alignItems: "flex-start" }}
          >
            <Stack spacing={0.75}>
              <Typography level="title-md">
                Unable to load this campaign
              </Typography>
              <Typography level="body-sm">
                {campaignQuery.error.message}
              </Typography>
              <Stack direction="row" spacing={1.25}>
                <Button
                  variant="solid"
                  color="danger"
                  onClick={() => void campaignQuery.refetch()}
                >
                  Retry
                </Button>
                <Button
                  variant="outlined"
                  color="neutral"
                  onClick={() => navigate("/sms")}
                >
                  Back to SMS
                </Button>
              </Stack>
            </Stack>
          </Alert>
        </Card>
      </PageContainer>
    );
  }

  if (!campaign) {
    return (
      <PageContainer fullWidth sx={{ py: 3 }}>
        <Card
          variant="outlined"
          sx={{ borderRadius: "28px", borderColor: "neutral.200", p: 3 }}
        >
          <Stack spacing={1.5} alignItems="flex-start">
            <Typography level="h3">Campaign not found</Typography>
            <Typography level="body-sm" color="neutral">
              This campaign may have been removed or you may not have access to
              it.
            </Typography>
            <Button
              variant="outlined"
              color="neutral"
              onClick={() => navigate("/sms")}
              startDecorator={<ArrowLeft size={16} />}
            >
              Back to SMS
            </Button>
          </Stack>
        </Card>
      </PageContainer>
    );
  }

  const metrics =
    campaign.metrics && typeof campaign.metrics === "object"
      ? (campaign.metrics as MetricsShape)
      : {};
  const deliveredCount = progress?.messages.delivered ?? metrics.delivered ?? 0;
  const sentCount = progress?.messages.sent ?? metrics.sent ?? 0;
  const failedCount = progress?.messages.failed ?? metrics.failed ?? 0;
  const audienceEstimate =
    progress?.messages.total ??
    campaign.total_recipients_estimate ??
    sentCount + failedCount;
  const deliveryRate =
    sentCount > 0 ? ((deliveredCount / sentCount) * 100).toFixed(1) : "0.0";
  const statusChip = getStatusChip(campaign.status);
  const mediaUrls = Array.isArray(campaign.media_urls)
    ? campaign.media_urls.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const totalPages = Math.max(
    1,
    Math.ceil((messagesQuery.data?.count ?? 0) / PAGE_SIZE),
  );
  const pagedMessages = messagesQuery.data?.items ?? [];
  const resumeStatus =
    campaign.scheduled_at &&
    new Date(campaign.scheduled_at).getTime() > Date.now()
      ? "scheduled"
      : "queued";
  const audienceDescriptor =
    campaign.targeting_persona_names &&
    campaign.targeting_persona_names.length > 0
      ? campaign.targeting_persona_names.join(", ")
      : campaign.segment_id
        ? "Segment-targeted audience"
        : "All subscribers";

  return (
    <PageContainer fullWidth sx={{ py: 3 }}>
      <BoxShell visible={showContent}>
        <Stack spacing={2.5}>
          <Card
            variant="outlined"
            sx={{
              borderRadius: "30px",
              borderColor: "neutral.200",
              p: { xs: 2.5, md: 3 },
            }}
          >
            <Stack spacing={1.5}>
              <Breadcrumbs separator="/" size="sm">
                <Link
                  component="button"
                  underline="hover"
                  color="neutral"
                  onClick={() => navigate("/sms")}
                >
                  SMS
                </Link>
                <Link
                  component="button"
                  underline="hover"
                  color="neutral"
                  onClick={() => navigate("/sms")}
                >
                  Campaigns
                </Link>
                <Typography level="body-sm">{campaign.name}</Typography>
              </Breadcrumbs>

              <Stack
                direction={{ xs: "column", xl: "row" }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xl: "flex-start" }}
              >
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip size="md" color={statusChip.color} variant="soft">
                      {statusChip.label}
                    </Chip>
                    {campaign.enqueue_status ? (
                      <Chip size="md" variant="soft" color="neutral">
                        {`Queue: ${campaign.enqueue_status}`}
                      </Chip>
                    ) : null}
                  </Stack>
                  <Typography
                    level="h1"
                    sx={{
                      fontSize: { xs: "2rem", md: "2.6rem" },
                      fontWeight: 700,
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {campaign.name}
                  </Typography>
                  <Typography
                    level="body-sm"
                    color="neutral"
                    sx={{ maxWidth: 760 }}
                  >
                    Monitor audience preparation, delivery progress, and
                    recipient-level outcomes from one real-time command surface.
                  </Typography>
                  <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
                    <MetaItem
                      label="Created"
                      value={formatDateTime(campaign.created_at)}
                    />
                    <MetaItem
                      label="Scheduled"
                      value={formatDateTime(campaign.scheduled_at)}
                    />
                    <MetaItem
                      label="Sent"
                      value={formatDateTime(campaign.sent_at)}
                    />
                  </Stack>
                </Stack>

                <Stack spacing={1.5} alignItems={{ xl: "flex-end" }}>
                  <Button
                    variant="plain"
                    color="neutral"
                    startDecorator={<ArrowLeft size={16} />}
                    onClick={() => navigate("/sms")}
                    sx={{ borderRadius: "12px" }}
                  >
                    Back to SMS
                  </Button>
                  <SmsCampaignActions
                    campaignId={campaign.id}
                    campaignName={campaign.name}
                    status={campaign.status}
                    failedCount={failedCount}
                    resumeStatus={resumeStatus}
                    onRetryComplete={() => void invalidateDetail()}
                    onStatusChange={() => void invalidateDetail()}
                    onDeleteComplete={() => navigate("/sms")}
                  />
                </Stack>
              </Stack>
            </Stack>
          </Card>

          {showProgress ? (
            <SmsCampaignProgressCard
              progress={progress}
              loading={progressLoading}
              error={progressError}
            />
          ) : null}

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            useFlexGap
            flexWrap="wrap"
          >
            <MetricCard
              label="Estimated audience"
              value={audienceEstimate.toLocaleString()}
              detail={audienceDescriptor}
              icon={<Users size={16} />}
            />
            <MetricCard
              label="Messages sent"
              value={sentCount.toLocaleString()}
              detail="Messages accepted for send"
              icon={<MessageSquareText size={16} />}
              color="primary"
            />
            <MetricCard
              label="Delivered"
              value={deliveredCount.toLocaleString()}
              detail={`${deliveryRate}% delivery rate`}
              icon={<ShieldAlert size={16} />}
              color="success"
            />
            <MetricCard
              label="Failed"
              value={failedCount.toLocaleString()}
              detail={`${metrics.opt_outs ?? 0} opt-outs tracked`}
              icon={<TimerReset size={16} />}
              color={failedCount > 0 ? "danger" : "neutral"}
            />
          </Stack>

          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={2.5}
            alignItems="flex-start"
          >
            <Stack spacing={2.5} sx={{ flex: 1, minWidth: 0 }}>
              <Card
                variant="outlined"
                sx={{
                  borderRadius: "28px",
                  borderColor: "neutral.200",
                  p: { xs: 2.5, md: 3 },
                }}
              >
                <Stack spacing={2}>
                  <Stack spacing={0.5}>
                    <Typography level="title-lg">Campaign Message</Typography>
                    <Typography level="body-sm" color="neutral">
                      The exact content associated with this campaign, including
                      MMS media.
                    </Typography>
                  </Stack>

                  {mediaUrls.length > 0 ? (
                    <Stack
                      direction="row"
                      spacing={1}
                      useFlexGap
                      flexWrap="wrap"
                    >
                      {mediaUrls.map((url, index) => (
                        <Sheet
                          key={`${url}-${index}`}
                          variant="outlined"
                          sx={{
                            borderRadius: "18px",
                            overflow: "hidden",
                            width: 96,
                            height: 96,
                          }}
                        >
                          <img
                            src={url}
                            alt={`Campaign media ${index + 1}`}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        </Sheet>
                      ))}
                    </Stack>
                  ) : null}

                  <Sheet
                    variant="soft"
                    color="primary"
                    sx={{
                      borderRadius: "26px 26px 12px 26px",
                      p: 2,
                      maxWidth: { xs: "100%", md: 680 },
                      alignSelf: "flex-start",
                    }}
                  >
                    <Typography
                      level="body-sm"
                      sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}
                    >
                      {campaign.message ||
                        "No message content stored for this campaign."}
                    </Typography>
                  </Sheet>
                </Stack>
              </Card>

              <Card
                variant="outlined"
                sx={{
                  borderRadius: "28px",
                  borderColor: "neutral.200",
                  p: 0,
                  overflow: "hidden",
                }}
              >
                <Stack spacing={0}>
                  <Stack
                    spacing={0.5}
                    sx={{ px: { xs: 2.5, md: 3 }, pt: 2.5, pb: 2 }}
                  >
                    <Typography level="title-lg">Recipient Log</Typography>
                    <Typography level="body-sm" color="neutral">
                      Paginated recipient-level outcomes for this campaign.
                    </Typography>
                  </Stack>

                  <Divider />

                  {messagesQuery.isLoading ? (
                    <Stack spacing={1} sx={{ p: 2.5 }}>
                      {Array.from({ length: 8 }).map((_, index) => (
                        <Skeleton
                          key={index}
                          variant="rectangular"
                          sx={{ height: 42, borderRadius: "12px" }}
                        />
                      ))}
                    </Stack>
                  ) : messagesQuery.error ? (
                    <Alert
                      color="danger"
                      variant="soft"
                      sx={{ m: 2.5, borderRadius: "18px" }}
                    >
                      {messagesQuery.error.message}
                    </Alert>
                  ) : pagedMessages.length === 0 ? (
                    <Stack spacing={0.75} sx={{ p: 3 }}>
                      <Typography level="title-sm">No messages yet</Typography>
                      <Typography level="body-sm" color="neutral">
                        Recipient-level SMS records will appear here once
                        delivery begins.
                      </Typography>
                    </Stack>
                  ) : (
                    <>
                      <Table
                        stripe="odd"
                        stickyHeader
                        sx={{
                          "--TableCell-headBackground":
                            "var(--joy-palette-background-level1)",
                          minWidth: 760,
                        }}
                      >
                        <thead>
                          <tr>
                            <th style={{ width: "18%" }}>Recipient</th>
                            <th style={{ width: "36%" }}>Message</th>
                            <th style={{ width: "14%" }}>Status</th>
                            <th style={{ width: "16%" }}>Sent</th>
                            <th style={{ width: "16%" }}>Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedMessages.map((message) => {
                            const chip = getMessageStatusChip(message.status);
                            return (
                              <tr key={message.id}>
                                <td>
                                  <Stack spacing={0.25}>
                                    <Typography level="body-sm" fontWeight="md">
                                      {message.phone || "Unknown recipient"}
                                    </Typography>
                                    <Typography level="body-xs" color="neutral">
                                      {message.from_phone || "Default sender"}
                                    </Typography>
                                  </Stack>
                                </td>
                                <td>
                                  <Typography
                                    level="body-sm"
                                    sx={{ maxWidth: 420, whiteSpace: "normal" }}
                                  >
                                    {`${message.content.slice(0, 96)}${message.content.length > 96 ? "…" : ""}`}
                                  </Typography>
                                </td>
                                <td>
                                  <Chip
                                    size="sm"
                                    variant="soft"
                                    color={chip.color}
                                  >
                                    {chip.label}
                                  </Chip>
                                </td>
                                <td>
                                  <Typography level="body-sm">
                                    {formatDateTime(
                                      message.sent_at || message.created_at,
                                    )}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography
                                    level="body-sm"
                                    color={
                                      message.error_message
                                        ? "danger"
                                        : "neutral"
                                    }
                                  >
                                    {message.error_message || "--"}
                                  </Typography>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>

                      <Divider />

                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        spacing={2}
                        sx={{ px: { xs: 2.5, md: 3 }, py: 1.75 }}
                      >
                        <Typography level="body-sm" color="neutral">
                          {`Showing ${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, messagesQuery.data?.count ?? 0)} of ${(messagesQuery.data?.count ?? 0).toLocaleString()} messages`}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="sm"
                            variant="outlined"
                            color="neutral"
                            startDecorator={<ChevronLeft size={14} />}
                            disabled={page === 1}
                            onClick={() =>
                              setPage((current) => Math.max(1, current - 1))
                            }
                            sx={{ borderRadius: "12px" }}
                          >
                            Previous
                          </Button>
                          <Button
                            size="sm"
                            variant="outlined"
                            color="neutral"
                            endDecorator={<ChevronRight size={14} />}
                            disabled={page >= totalPages}
                            onClick={() =>
                              setPage((current) =>
                                Math.min(totalPages, current + 1),
                              )
                            }
                            sx={{ borderRadius: "12px" }}
                          >
                            Next
                          </Button>
                        </Stack>
                      </Stack>
                    </>
                  )}
                </Stack>
              </Card>
            </Stack>

            <Stack spacing={2.5} sx={{ width: { lg: 360 }, flexShrink: 0 }}>
              <Card
                variant="outlined"
                sx={{
                  borderRadius: "28px",
                  borderColor: "neutral.200",
                  p: 2.5,
                }}
              >
                <Stack spacing={1.5}>
                  <Typography level="title-lg">Campaign Summary</Typography>
                  <SummaryRow label="Status" value={statusChip.label} />
                  <SummaryRow label="Audience" value={audienceDescriptor} />
                  <SummaryRow
                    label="Recipients"
                    value={audienceEstimate.toLocaleString()}
                  />
                  <SummaryRow
                    label="Created"
                    value={formatDateTime(campaign.created_at)}
                  />
                  <SummaryRow
                    label="Scheduled"
                    value={formatDateTime(campaign.scheduled_at)}
                  />
                  <SummaryRow
                    label="Sent"
                    value={formatDateTime(campaign.sent_at)}
                  />
                  <SummaryRow label="Source" value={campaign.source || "--"} />
                  <SummaryRow
                    label="From phone"
                    value={campaign.from_phone || "Default sender"}
                  />
                </Stack>
              </Card>

              <Card
                variant="soft"
                color="neutral"
                sx={{ borderRadius: "28px", p: 2.5 }}
              >
                <Stack spacing={1.25}>
                  <Typography level="title-lg">Performance Snapshot</Typography>
                  <Typography level="body-sm" color="neutral">
                    Use this summary to compare delivery velocity against the
                    campaign's final recipient set.
                  </Typography>
                  <Chip
                    size="sm"
                    variant="soft"
                    color="primary"
                    startDecorator={<CalendarClock size={14} />}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    {campaign.scheduled_at
                      ? `Scheduled ${formatDateTime(campaign.scheduled_at)}`
                      : "No scheduled time"}
                  </Chip>
                  <Divider />
                  <SummaryRow
                    label="Delivered"
                    value={deliveredCount.toLocaleString()}
                  />
                  <SummaryRow
                    label="Clicked"
                    value={(metrics.clicked ?? 0).toLocaleString()}
                  />
                  <SummaryRow
                    label="Opt-outs"
                    value={(metrics.opt_outs ?? 0).toLocaleString()}
                  />
                  <SummaryRow
                    label="Revenue"
                    value={`$${(metrics.revenue ?? 0).toFixed(2)}`}
                  />
                </Stack>
              </Card>
            </Stack>
          </Stack>
        </Stack>
      </BoxShell>
    </PageContainer>
  );
}

function BoxShell({
  visible,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  return (
    <Sheet
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 240ms ease-out, transform 240ms ease-out",
        backgroundColor: "transparent",
      }}
    >
      {children}
    </Sheet>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.25}>
      <Typography level="body-xs" color="neutral">
        {label}
      </Typography>
      <Typography level="body-sm" fontWeight="md">
        {value}
      </Typography>
    </Stack>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography level="body-sm" color="neutral">
        {label}
      </Typography>
      <Typography level="body-sm" fontWeight="md" textAlign="right">
        {value}
      </Typography>
    </Stack>
  );
}
