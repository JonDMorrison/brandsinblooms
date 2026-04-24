import React, { useMemo } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Link from "@mui/joy/Link";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  Link as RouterLink,
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";
import { ActivityDescription } from "@/components/activity/ActivityDescription";
import { ActivityKeyValueList } from "@/components/activity/ActivityKeyValueList";
import ActivityDetailSkeleton from "@/components/activity/ActivityDetailSkeleton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import {
  ActivityStatusMarker,
  formatActivityActor,
  formatActivitySource,
  getActivityStatusTone,
  isInternalHref,
} from "@/components/activity/activityPresentation";
import { JoyChip } from "@/components/joy/JoyChip";
import { PageContainer } from "@/components/joy/PageContainer";
import { useActivityEvent } from "@/hooks/useActivityEvent";

const LABEL_MAP: Record<string, string> = {
  customer_id: "Customer",
  automation_id: "Automation",
  automation_run_id: "Automation Run",
  run_sequence: "Run Sequence",
  trigger_type: "Trigger",
  step_index: "Step",
  segment_id: "Segment",
  segment_name: "Segment",
  persona_id: "Persona",
  email: "Email",
  phone: "Phone",
};

function classifyError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "";
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number(error.status)
      : null;

  return {
    message,
    isAuth:
      status === 401 ||
      status === 403 ||
      /auth|jwt|permission|forbidden|rls|not authenticated/i.test(message),
    isNetwork:
      error instanceof TypeError ||
      /network|failed to fetch|fetch failed/i.test(message),
  };
}

export default function ActivityDetailsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const {
    data: event,
    error,
    isError,
    isLoading,
    refetch,
  } = useActivityEvent(eventId);

  const ts = useMemo(() => (event ? new Date(event.timestamp) : null), [event]);
  const relative = useMemo(() => {
    if (!ts) return "";
    try {
      return formatDistanceToNowStrict(ts, { addSuffix: true });
    } catch {
      return "";
    }
  }, [ts]);

  const absolute = useMemo(() => {
    if (!ts) return "";
    try {
      return format(ts, "PPpp");
    } catch {
      return "";
    }
  }, [ts]);

  const customerHref = event?.customer_id
    ? `/crm/customers/${event.customer_id}`
    : null;

  const errorState = classifyError(error);

  const automationContext = useMemo(() => {
    if (!event) return null;
    const metadata = (event.metadata ?? {}) as Record<string, unknown>;
    const related = (event.related_entities ?? {}) as Record<string, unknown>;
    const context = {
      automation_id: metadata.automation_id ?? related.automation_id,
      automation_run_id:
        metadata.automation_run_id ?? related.automation_run_id,
      run_sequence: metadata.run_sequence,
      trigger_type: metadata.trigger_type,
      step_index: metadata.step_index,
    } as Record<string, unknown>;

    const hasAutomation =
      String(event.activity_type || "").includes("automation") ||
      Object.values(context).some(
        (value) => value !== undefined && value !== null,
      );

    return hasAutomation ? context : null;
  }, [event]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/activity");
  };

  const pageHeader = (
    <Stack spacing={1}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        useFlexGap
        flexWrap="wrap"
      >
        <Link component={RouterLink} to="/activity" underline="hover">
          Activity Center
        </Link>
        <Typography level="body-xs" color="neutral">
          /
        </Typography>
        <Typography level="body-xs" color="neutral">
          Event details
        </Typography>
      </Stack>
      <Button
        size="sm"
        variant="plain"
        color="neutral"
        startDecorator={<ArrowLeft size={14} />}
        onClick={handleBack}
        sx={{ alignSelf: "flex-start", px: 0 }}
      >
        Back
      </Button>
    </Stack>
  );

  if (isLoading) {
    return (
      <PageContainer>
        <Stack
          spacing={2.5}
          sx={{ px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3.5 } }}
        >
          {pageHeader}
          <ActivityDetailSkeleton />
        </Stack>
      </PageContainer>
    );
  }

  if (isError && errorState.isAuth) {
    return <Navigate to="/auth" replace />;
  }

  if (isError && errorState.isNetwork) {
    return (
      <PageContainer>
        <Stack
          spacing={2.5}
          sx={{ px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3.5 } }}
        >
          {pageHeader}
          <Sheet
            color="warning"
            variant="soft"
            sx={{ borderRadius: "2xl", px: 3, py: 3 }}
          >
            <Stack spacing={1.5}>
              <Typography level="title-md">
                Couldn&apos;t reach activity details
              </Typography>
              <Typography level="body-sm" color="warning">
                {errorState.message ||
                  "The request failed before the event details could be loaded."}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="sm"
                  variant="solid"
                  color="warning"
                  onClick={() => refetch()}
                >
                  Retry
                </Button>
                <Button
                  size="sm"
                  variant="plain"
                  color="neutral"
                  onClick={handleBack}
                >
                  Back to activity
                </Button>
              </Stack>
            </Stack>
          </Sheet>
        </Stack>
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <Stack
          spacing={2.5}
          sx={{ px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3.5 } }}
        >
          {pageHeader}
          <Sheet
            color="danger"
            variant="soft"
            sx={{ borderRadius: "2xl", px: 3, py: 3 }}
          >
            <Stack spacing={1.5}>
              <Typography level="title-md">
                Activity details unavailable
              </Typography>
              <Typography level="body-sm" color="danger">
                {errorState.message ||
                  "Something went wrong while loading this event."}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="sm"
                  variant="solid"
                  color="danger"
                  onClick={() => refetch()}
                >
                  Retry
                </Button>
                <Button
                  size="sm"
                  variant="plain"
                  color="neutral"
                  onClick={handleBack}
                >
                  Back to activity
                </Button>
              </Stack>
            </Stack>
          </Sheet>
        </Stack>
      </PageContainer>
    );
  }

  if (!event) {
    return (
      <PageContainer>
        <Stack
          spacing={2.5}
          sx={{ px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3.5 } }}
        >
          {pageHeader}
          <Sheet variant="soft" sx={{ borderRadius: "2xl", px: 3, py: 3 }}>
            <Stack spacing={1.5}>
              <Typography level="title-md">
                This activity event no longer exists
              </Typography>
              <Typography level="body-sm" color="neutral">
                The ID may be invalid, or the underlying record may have been
                removed.
              </Typography>
              <Box>
                <Button
                  size="sm"
                  variant="solid"
                  color="primary"
                  onClick={handleBack}
                >
                  Back to activity
                </Button>
              </Box>
            </Stack>
          </Sheet>
        </Stack>
      </PageContainer>
    );
  }

  const links = Array.isArray(event.links) ? event.links : [];

  return (
    <PageContainer>
      <Stack
        spacing={2.5}
        sx={{ px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3.5 } }}
      >
        {pageHeader}

        <JoyCard>
          <JoyCardHeader
            startDecorator={
              <ActivityStatusMarker status={event.status} size={42} />
            }
            title={event.title || "Activity event"}
            description={`${absolute || event.timestamp}${relative ? ` · ${relative}` : ""}`}
            actions={
              customerHref ? (
                <Button
                  component={RouterLink}
                  to={customerHref}
                  size="sm"
                  variant="soft"
                  color="primary"
                >
                  View customer
                </Button>
              ) : undefined
            }
          >
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              sx={{ pt: 1 }}
            >
              <JoyChip
                size="sm"
                variant="soft"
                color={getActivityStatusTone(event.status)}
              >
                {String(event.status)}
              </JoyChip>
              <JoyChip size="sm" variant="soft" color="neutral">
                {formatActivityActor(event.actor_type)}
              </JoyChip>
              <JoyChip size="sm" variant="soft" color="neutral">
                {formatActivitySource(event.source)}
              </JoyChip>
              <JoyChip size="sm" variant="soft" color="primary">
                {event.activity_type}
              </JoyChip>
              {event.integration_name ? (
                <JoyChip size="sm" variant="soft" color="warning">
                  {event.integration_name}
                </JoyChip>
              ) : null}
            </Stack>
          </JoyCardHeader>
          <JoyCardContent sx={{ pt: 3 }}>
            <Stack spacing={2}>
              <Box>
                <Typography level="title-sm">What happened</Typography>
                <Box sx={{ mt: 1.25 }}>
                  <ActivityDescription description={event.description} />
                  {!event.description?.parts?.length ? (
                    <Typography level="body-sm" color="neutral">
                      No description available.
                    </Typography>
                  ) : null}
                </Box>
              </Box>

              {event.error_message ? (
                <Sheet
                  color="danger"
                  variant="soft"
                  sx={{ borderRadius: "lg", px: 2, py: 1.5 }}
                >
                  <Typography level="body-sm" color="danger">
                    {event.error_message}
                  </Typography>
                </Sheet>
              ) : null}
            </Stack>
          </JoyCardContent>
        </JoyCard>

        {automationContext ? (
          <JoyCard>
            <JoyCardHeader title="Automation context" />
            <JoyCardContent sx={{ pt: 3 }}>
              <Stack spacing={2}>
                <ActivityKeyValueList
                  data={automationContext}
                  labelMap={LABEL_MAP}
                  emptyLabel="No automation details"
                />
                {automationContext.automation_id ? (
                  <Box>
                    <Link
                      component={RouterLink}
                      to={`/crm/automations/${automationContext.automation_id}`}
                      underline="hover"
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      <ExternalLink size={14} />
                      Open automation
                    </Link>
                  </Box>
                ) : null}
              </Stack>
            </JoyCardContent>
          </JoyCard>
        ) : null}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
            gap: 2.5,
          }}
        >
          <JoyCard>
            <JoyCardHeader title="Metadata" />
            <JoyCardContent sx={{ pt: 3 }}>
              <ActivityKeyValueList
                data={(event.metadata ?? {}) as Record<string, unknown>}
                labelMap={LABEL_MAP}
                emptyLabel="No metadata"
              />
            </JoyCardContent>
          </JoyCard>

          <JoyCard>
            <JoyCardHeader title="Related" />
            <JoyCardContent sx={{ pt: 3 }}>
              <ActivityKeyValueList
                data={(event.related_entities ?? {}) as Record<string, unknown>}
                hiddenKeys={["customer_id"]}
                labelMap={LABEL_MAP}
                emptyLabel="No related items"
              />
            </JoyCardContent>
          </JoyCard>
        </Box>

        <JoyCard>
          <JoyCardHeader title="Links & references" />
          <JoyCardContent sx={{ pt: 3 }}>
            <Stack spacing={1.25}>
              {links.length ? (
                links
                  .filter(
                    (link) => link && typeof link === "object" && link.href,
                  )
                  .map((link, idx) => {
                    const href = String(link.href);
                    const label = String(
                      link.label || link.type || "Open link",
                    );

                    if (isInternalHref(href)) {
                      return (
                        <Link
                          key={`${href}:${idx}`}
                          component={RouterLink}
                          to={href}
                          underline="hover"
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.75,
                          }}
                        >
                          <ExternalLink size={14} />
                          {label}
                        </Link>
                      );
                    }

                    return (
                      <Link
                        key={`${href}:${idx}`}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        underline="hover"
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.75,
                        }}
                      >
                        <ExternalLink size={14} />
                        {label}
                      </Link>
                    );
                  })
              ) : (
                <Typography level="body-sm" color="neutral">
                  No links available.
                </Typography>
              )}
            </Stack>
          </JoyCardContent>
        </JoyCard>
      </Stack>
    </PageContainer>
  );
}
