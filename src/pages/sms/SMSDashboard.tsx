import * as React from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQueryClient } from "@tanstack/react-query";
import {
  JoyTabs,
  JoyTabsContent,
  JoyTabsList,
  JoyTabsTrigger,
} from "@/components/joy/JoyTabs";
import {
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Target,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTwilioSetup } from "@/components/dashboard/TwilioSetupChecker";
import { PageContainer } from "@/components/joy/PageContainer";
import { SMSCampaignsTable } from "@/components/sms/SMSCampaignsTable";
import { SMSQuickSend } from "@/components/sms/SMSQuickSend";
import { SMSQueueStatus } from "@/components/sms/SMSQueueStatus";
import { SMSRecentMessages } from "@/components/sms/SMSRecentMessages";
import { SMSSetupWizard } from "@/components/sms/SMSSetupWizard";
import { SMSStatCards } from "@/components/sms/SMSStatCards";
import { SendATextCard } from "@/components/sms/SendATextCard";
import { SendToSegmentCard } from "@/components/sms/SendToSegmentCard";
import { useSMSStats, type SMSStats } from "@/hooks/useSMSStats";

type DashboardSectionKey =
  | "stats"
  | "campaigns"
  | "messages"
  | "actions"
  | "queue";

type DashboardRevealState = Record<DashboardSectionKey, boolean>;

const STAT_GRID_COLUMNS = {
  xs: "1fr",
  sm: "repeat(2, minmax(0, 1fr))",
  md: "repeat(3, minmax(0, 1fr))",
  xl: "repeat(5, minmax(0, 1fr))",
} as const;

const REVEAL_DELAYS: Record<DashboardSectionKey, number> = {
  stats: 0,
  campaigns: 90,
  actions: 140,
  messages: 200,
  queue: 260,
};

const INITIAL_REVEAL_STATE: DashboardRevealState = {
  stats: false,
  campaigns: false,
  messages: false,
  actions: false,
  queue: false,
};

const EMPTY_SMS_STATS: SMSStats = {
  subscribers: 0,
  subscribersGrowth: 0,
  credits: 0,
  creditsUsed: 0,
  deliverability: 0,
  deliverabilityGrowth: 0,
  clicks: 0,
  clicksGrowth: 0,
  queuedMessages: 0,
  recentCampaigns: [],
  recentMessages: [],
};

function SurfaceSkeleton({
  height,
  radius = "20px",
}: {
  height: number;
  radius?: string;
}) {
  return (
    <Box
      sx={{ position: "relative", overflow: "hidden", borderRadius: radius }}
    >
      <Skeleton
        variant="overlay"
        animation="wave"
        sx={{ borderRadius: radius }}
      >
        <Box sx={{ width: "100%", height }} />
      </Skeleton>
    </Box>
  );
}

function FadeInSection({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <Box
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 240ms ease-out, transform 240ms ease-out",
      }}
    >
      {children}
    </Box>
  );
}

function HeaderSkeleton() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", lg: "row" },
        alignItems: { xs: "stretch", lg: "center" },
        justifyContent: "space-between",
        gap: 2,
        px: { xs: 2.5, md: 3 },
        py: { xs: 2.5, md: 3 },
        borderRadius: "24px",
        border: "1px solid",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
      }}
    >
      <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
        <Skeleton
          variant="inline"
          animation="wave"
          sx={{ width: 220, height: 34, borderRadius: "sm" }}
        />
        <Skeleton
          variant="inline"
          animation="wave"
          sx={{
            width: { xs: "100%", sm: 360 },
            height: 16,
            borderRadius: "sm",
          }}
        />
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        justifyContent={{ xs: "flex-start", lg: "flex-end" }}
      >
        <Skeleton
          variant="inline"
          animation="wave"
          sx={{ width: 96, height: 32, borderRadius: "999px" }}
        />
        <Skeleton
          variant="inline"
          animation="wave"
          sx={{ width: 126, height: 40, borderRadius: "12px" }}
        />
        <Skeleton
          variant="inline"
          animation="wave"
          sx={{ width: 164, height: 40, borderRadius: "12px" }}
        />
      </Stack>
    </Box>
  );
}

function StatCardSkeleton() {
  return (
    <Card
      variant="outlined"
      sx={{
        p: 2.5,
        minHeight: 184,
        borderRadius: "24px",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
      }}
    >
      <Stack spacing={2.25} sx={{ height: "100%" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Skeleton
            variant="inline"
            animation="wave"
            sx={{ width: 96, height: 12, borderRadius: "sm" }}
          />
          <Skeleton
            variant="circular"
            animation="wave"
            width={36}
            height={36}
          />
        </Box>
        <Skeleton
          variant="inline"
          animation="wave"
          sx={{ width: "58%", height: 40, borderRadius: "sm" }}
        />
        <Skeleton
          variant="inline"
          animation="wave"
          sx={{ width: "72%", height: 14, borderRadius: "sm" }}
        />
      </Stack>
    </Card>
  );
}

function ListSectionSkeleton({
  titleWidth,
  descriptionWidth,
  actionWidth,
  rowCount,
  rowHeight,
}: {
  titleWidth: number;
  descriptionWidth: number;
  actionWidth?: number;
  rowCount: number;
  rowHeight: number;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: "28px",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
          px: 2.5,
          py: 2.5,
          borderBottom: "1px solid",
          borderColor: "neutral.100",
        }}
      >
        <Stack spacing={1}>
          <Skeleton
            variant="inline"
            animation="wave"
            sx={{ width: titleWidth, height: 18, borderRadius: "sm" }}
          />
          <Skeleton
            variant="inline"
            animation="wave"
            sx={{ width: descriptionWidth, height: 14, borderRadius: "sm" }}
          />
        </Stack>
        {actionWidth ? (
          <Skeleton
            variant="inline"
            animation="wave"
            sx={{ width: actionWidth, height: 36, borderRadius: "12px" }}
          />
        ) : null}
      </Box>

      <Stack spacing={1.25} sx={{ p: 2.5 }}>
        {Array.from({ length: rowCount }).map((_, index) => (
          <SurfaceSkeleton key={index} height={rowHeight} radius="22px" />
        ))}
      </Stack>
    </Card>
  );
}

function ActionsPanelSkeleton() {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: "28px",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        overflow: "hidden",
      }}
    >
      <Stack spacing={0}>
        <Stack spacing={1} sx={{ px: 2.5, py: 2.5 }}>
          <Skeleton
            variant="inline"
            animation="wave"
            sx={{ width: 124, height: 18, borderRadius: "sm" }}
          />
          <Skeleton
            variant="inline"
            animation="wave"
            sx={{ width: 240, height: 14, borderRadius: "sm" }}
          />
        </Stack>
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <SurfaceSkeleton height={44} radius="18px" />
          <Box sx={{ mt: 2 }}>
            <SurfaceSkeleton height={304} radius="22px" />
          </Box>
        </Box>
      </Stack>
    </Card>
  );
}

function QueueSkeleton() {
  return (
    <Card
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: "24px",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
      }}
    >
      <Stack spacing={2}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Skeleton
              variant="circular"
              animation="wave"
              width={40}
              height={40}
            />
            <Stack spacing={0.75}>
              <Skeleton
                variant="inline"
                animation="wave"
                sx={{ width: 112, height: 16, borderRadius: "sm" }}
              />
              <Skeleton
                variant="inline"
                animation="wave"
                sx={{ width: 156, height: 14, borderRadius: "sm" }}
              />
            </Stack>
          </Stack>
          <Stack spacing={1} alignItems="flex-end">
            <Skeleton
              variant="inline"
              animation="wave"
              sx={{ width: 44, height: 28, borderRadius: "sm" }}
            />
            <Skeleton
              variant="inline"
              animation="wave"
              sx={{ width: 118, height: 36, borderRadius: "12px" }}
            />
          </Stack>
        </Box>
        <SurfaceSkeleton height={56} radius="20px" />
      </Stack>
    </Card>
  );
}

function SMSSetupTakeoverCard({
  statusMessage,
  onComplete,
  onManualSetup,
}: {
  statusMessage?: string;
  onComplete: () => void;
  onManualSetup: () => void;
}) {
  const setupHighlights = [
    {
      title: "Send test texts",
      description:
        "Verify delivery and formatting before you launch larger sends.",
      icon: <Send size={16} />,
      color: "primary",
    },
    {
      title: "Target the right audience",
      description:
        "Use segments and recent campaign views once setup is complete.",
      icon: <Target size={16} />,
      color: "success",
    },
    {
      title: "Process queued sends",
      description:
        "Monitor backlog health and manually run the worker when needed.",
      icon: <RefreshCw size={16} />,
      color: "warning",
    },
  ] as const;

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: "28px",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            xl: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
          },
          gap: 2.5,
          px: { xs: 2.5, md: 3 },
          py: { xs: 2.5, md: 3 },
        }}
      >
        <Stack spacing={2.25}>
          <Chip
            size="sm"
            variant="soft"
            color="warning"
            startDecorator={<Zap size={14} />}
            sx={{ alignSelf: "flex-start", fontWeight: "lg" }}
          >
            Welcome to SMS
          </Chip>

          <Stack spacing={1}>
            <Typography
              level="h2"
              sx={{ fontWeight: 700, letterSpacing: "-0.03em" }}
            >
              Finish setup to unlock campaigns, testing, and queue controls.
            </Typography>
            <Typography level="body-sm" color="neutral" sx={{ maxWidth: 560 }}>
              {statusMessage ??
                "Connect SMS once, then launch campaigns, send quick tests, and monitor delivery from this dashboard."}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <SMSSetupWizard
              trigger={
                <Button
                  variant="solid"
                  color="warning"
                  startDecorator={<Zap size={16} />}
                  sx={{ borderRadius: "12px", fontWeight: "lg" }}
                >
                  Start Setup Wizard
                </Button>
              }
              onComplete={onComplete}
            />
            <Button
              variant="outlined"
              color="neutral"
              onClick={onManualSetup}
              sx={{ borderRadius: "12px" }}
            >
              Manual Setup
            </Button>
          </Stack>
        </Stack>

        <Stack spacing={1.25}>
          {setupHighlights.map((highlight) => (
            <Box
              key={highlight.title}
              sx={{
                borderRadius: "18px",
                border: "1px solid",
                borderColor: "neutral.200",
                backgroundColor: "background.level1",
                px: 2,
                py: 1.75,
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "14px",
                    display: "grid",
                    placeItems: "center",
                    backgroundColor: `${highlight.color}.100`,
                    color: `${highlight.color}.700`,
                    flexShrink: 0,
                  }}
                >
                  {highlight.icon}
                </Box>
                <Stack spacing={0.5}>
                  <Typography level="body-sm" fontWeight="md">
                    {highlight.title}
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    {highlight.description}
                  </Typography>
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
    </Card>
  );
}

function SMSDashboardSkeleton() {
  return (
    <PageContainer fullWidth sx={{ backgroundColor: "background.body" }}>
      <Stack spacing={2.5} sx={{ pb: 4 }}>
        <HeaderSkeleton />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: STAT_GRID_COLUMNS,
            gap: 2,
          }}
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              xl: "minmax(0, 1.65fr) minmax(320px, 0.95fr)",
            },
            gap: 2.5,
            alignItems: "start",
          }}
        >
          <Stack spacing={2.5} sx={{ minWidth: 0 }}>
            <ListSectionSkeleton
              titleWidth={168}
              descriptionWidth={264}
              actionWidth={124}
              rowCount={5}
              rowHeight={88}
            />
            <ListSectionSkeleton
              titleWidth={156}
              descriptionWidth={248}
              actionWidth={92}
              rowCount={4}
              rowHeight={74}
            />
          </Stack>

          <Stack
            spacing={2.5}
            sx={{
              minWidth: 0,
              alignSelf: "start",
              position: { xs: "static", xl: "sticky" },
              top: { xl: 24 },
            }}
          >
            <ActionsPanelSkeleton />
            <QueueSkeleton />
          </Stack>
        </Box>
      </Stack>
    </PageContainer>
  );
}

export default function SMSDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: twilioSetup, isLoading: isSetupLoading } = useTwilioSetup();
  const { data: stats, error: statsError, isLoading, refetch } = useSMSStats();
  const [revealedSections, setRevealedSections] =
    React.useState<DashboardRevealState>(INITIAL_REVEAL_STATE);

  const isSmsReady = Boolean(twilioSetup?.isSetup);
  const isShellLoading = isSetupLoading || (isSmsReady && isLoading && !stats);
  const statsUnavailable =
    isSmsReady && !isShellLoading && (Boolean(statsError) || !stats);
  const statsData = stats ?? EMPTY_SMS_STATS;

  React.useEffect(() => {
    if (isShellLoading) {
      setRevealedSections(INITIAL_REVEAL_STATE);
      return;
    }

    const timeouts = (
      Object.entries(REVEAL_DELAYS) as Array<[DashboardSectionKey, number]>
    ).map(([key, delay]) =>
      window.setTimeout(() => {
        setRevealedSections((current) => ({ ...current, [key]: true }));
      }, delay),
    );

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [isShellLoading]);

  const handleSetupComplete = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["twilio-setup"] });
    void refetch();
  }, [queryClient, refetch]);

  const handleCreateCampaign = React.useCallback(() => {
    if (!isSmsReady) {
      navigate("/dashboard/integrations");
      return;
    }

    navigate("/sms/new");
  }, [isSmsReady, navigate]);

  const handleCardClick = React.useCallback((cardType: string) => {
    const targetId =
      {
        subscribers: "campaigns",
        credits: "actions",
        deliverability: "campaigns",
        clicks: "messages",
        queue: "queue",
      }[cardType] || "campaigns";

    const element = document.getElementById(targetId);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (isShellLoading) {
    return <SMSDashboardSkeleton />;
  }

  return (
    <PageContainer fullWidth sx={{ backgroundColor: "background.body" }}>
      <FadeInSection>
        <Stack spacing={2.5} sx={{ pb: 4 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", lg: "row" },
              alignItems: { xs: "stretch", lg: "center" },
              justifyContent: "space-between",
              gap: 2,
              px: { xs: 2.5, md: 3 },
              py: { xs: 2.5, md: 3 },
              borderRadius: "24px",
              border: "1px solid",
              borderColor: "neutral.200",
              backgroundColor: "background.surface",
            }}
          >
            <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
              <Typography level="h3" fontWeight="lg">
                SMS Campaigns
              </Typography>
              <Typography level="body-sm" color="neutral">
                Create, launch, and monitor SMS marketing from one polished
                command center.
              </Typography>
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              alignItems="center"
              justifyContent={{ xs: "flex-start", lg: "flex-end" }}
            >
              <Chip
                size="sm"
                variant="soft"
                color={isSmsReady ? "success" : "warning"}
                startDecorator={
                  <Box
                    component="span"
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: isSmsReady
                        ? "success.500"
                        : "warning.500",
                    }}
                  />
                }
                sx={{ fontWeight: "lg" }}
              >
                {isSmsReady ? "SMS Ready" : "Setup required"}
              </Chip>

              <Button
                variant="outlined"
                color="neutral"
                startDecorator={<Settings2 size={16} />}
                onClick={() => navigate("/sms/automations")}
                sx={{ borderRadius: "12px" }}
              >
                Automations
              </Button>

              <Button
                variant="solid"
                color="primary"
                startDecorator={<Plus size={16} />}
                onClick={handleCreateCampaign}
                sx={{ borderRadius: "12px", fontWeight: "lg", boxShadow: "sm" }}
              >
                Create Campaign
              </Button>
            </Stack>
          </Box>

          {!isSmsReady ? (
            <FadeInSection>
              <Box
                sx={{
                  opacity: 0.56,
                  pointerEvents: "none",
                  filter: "saturate(0.65)",
                }}
              >
                <SMSStatCards
                  stats={EMPTY_SMS_STATS}
                  onCardClick={() => undefined}
                />
              </Box>
            </FadeInSection>
          ) : statsUnavailable ? (
            <Alert
              variant="soft"
              color="neutral"
              startDecorator={<TriangleAlert size={18} />}
              endDecorator={
                <Button
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  startDecorator={<RefreshCw size={15} />}
                  onClick={() => void refetch()}
                  sx={{ borderRadius: "10px" }}
                >
                  Refresh
                </Button>
              }
              sx={{ borderRadius: "20px", px: 2.5, py: 1.5 }}
            >
              <Box>
                <Typography level="body-sm" fontWeight="lg">
                  SMS statistics are loading or unavailable
                </Typography>
                <Typography level="body-xs" color="neutral">
                  The dashboard can still load, but live KPI cards are not ready
                  yet.
                </Typography>
              </Box>
            </Alert>
          ) : revealedSections.stats ? (
            <FadeInSection>
              <SMSStatCards stats={statsData} onCardClick={handleCardClick} />
            </FadeInSection>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: STAT_GRID_COLUMNS,
                gap: 2,
              }}
            >
              {Array.from({ length: 5 }).map((_, index) => (
                <StatCardSkeleton key={index} />
              ))}
            </Box>
          )}

          {!isSmsReady ? (
            <FadeInSection>
              <SMSSetupTakeoverCard
                statusMessage={twilioSetup?.statusMessage}
                onComplete={handleSetupComplete}
                onManualSetup={() => navigate("/dashboard/integrations")}
              />
            </FadeInSection>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  xl: "minmax(0, 1.65fr) minmax(320px, 0.95fr)",
                },
                gap: 2.5,
                alignItems: "start",
              }}
            >
              <Stack spacing={2.5} sx={{ minWidth: 0 }}>
                <SMSCampaignsTable
                  campaigns={statsData.recentCampaigns}
                  loading={!revealedSections.campaigns}
                  onCreateCampaign={handleCreateCampaign}
                />

                <SMSRecentMessages
                  messages={statsData.recentMessages}
                  loading={!revealedSections.messages}
                />
              </Stack>

              <Stack
                spacing={2.5}
                sx={{
                  minWidth: 0,
                  alignSelf: "start",
                  position: { xs: "static", xl: "sticky" },
                  top: { xl: 24 },
                }}
              >
                <Card
                  id="actions"
                  variant="outlined"
                  sx={{
                    borderRadius: "28px",
                    borderColor: "neutral.200",
                    backgroundColor: "background.surface",
                    p: 0,
                    overflow: "hidden",
                  }}
                >
                  <Stack spacing={0}>
                    <Stack spacing={0.75} sx={{ px: 2.5, py: 2.5, pb: 2 }}>
                      <Typography level="title-lg" fontWeight="lg">
                        Send & Test
                      </Typography>
                      <Typography level="body-sm" color="neutral">
                        Keep sending tools close by without dominating the
                        dashboard.
                      </Typography>
                    </Stack>

                    <Box sx={{ px: 2.5, pb: 2.5 }}>
                      {revealedSections.actions ? (
                        <JoyTabs
                          defaultValue="send-text"
                          sx={{ width: "100%" }}
                        >
                          <JoyTabsList
                            sx={{
                              display: "grid",
                              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                              borderRadius: "18px",
                              backgroundColor: "background.level1",
                            }}
                          >
                            <JoyTabsTrigger value="send-text">
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.75,
                                }}
                              >
                                <Send size={14} />
                                Send Text
                              </Box>
                            </JoyTabsTrigger>
                            <JoyTabsTrigger value="quick-send">
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.75,
                                }}
                              >
                                <Zap size={14} />
                                Quick Send
                              </Box>
                            </JoyTabsTrigger>
                            <JoyTabsTrigger value="segments">
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.75,
                                }}
                              >
                                <Target size={14} />
                                Segments
                              </Box>
                            </JoyTabsTrigger>
                          </JoyTabsList>

                          <JoyTabsContent value="send-text">
                            <SendATextCard onSent={() => void refetch()} />
                          </JoyTabsContent>
                          <JoyTabsContent value="quick-send">
                            <SMSQuickSend onSent={() => void refetch()} />
                          </JoyTabsContent>
                          <JoyTabsContent value="segments">
                            <SendToSegmentCard />
                          </JoyTabsContent>
                        </JoyTabs>
                      ) : (
                        <>
                          <SurfaceSkeleton height={44} radius="18px" />
                          <Box sx={{ mt: 2 }}>
                            <SurfaceSkeleton height={304} radius="22px" />
                          </Box>
                        </>
                      )}
                    </Box>
                  </Stack>
                </Card>

                <SMSQueueStatus
                  queuedMessages={statsData.queuedMessages}
                  loading={!revealedSections.queue}
                  onRefresh={() => {
                    void refetch();
                  }}
                />
              </Stack>
            </Box>
          )}
        </Stack>
      </FadeInSection>
    </PageContainer>
  );
}
