import { useEffect, useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useNavigate } from "react-router-dom";
import { useOnboardingStatus } from "@/contexts/OnboardingStatusContext";
import { useAuth } from "@/contexts/AuthContext";
import { LaunchpadModal } from "@/components/dashboard/LaunchpadModal";
import { QuickStartTour } from "@/components/dashboard/QuickStartTour";
import { PostComposerModal } from "@/components/dashboard/PostComposerModal";
import {
  useConnectedAccounts,
  getConnectionStatus,
} from "@/components/dashboard/ConnectedAccountChecker";
import {
  useTwilioSetup,
  getTwilioStatus,
} from "@/components/dashboard/TwilioSetupChecker";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyStatCard } from "@/components/joy/JoyStatCard";
import { useCRMDashboardMetrics } from "@/hooks/useCRMDashboardMetrics";
import { usePOSAnalytics } from "@/hooks/usePOSAnalytics";
import {
  ArrowRight,
  BarChart3,
  Mail,
  Megaphone,
  Calendar,
  Share2,
  Globe,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { CreateFlowDialog } from "@/components/create-flow/CreateFlowDialog";
import { DashboardSetupWizard } from "@/components/dashboard/DashboardSetupWizard";

export const BloomSuiteDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    isCompleted,
    hasEverCompleted,
    isLoading: onboardingLoading,
  } = useOnboardingStatus();
  const [showLaunchpad, setShowLaunchpad] = useState(false);
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [showQuickTour, setShowQuickTour] = useState(false);
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  const { data: socialConnections = [], isLoading: loadingConnections } =
    useConnectedAccounts();
  const { data: twilioData, isLoading: loadingTwilio } = useTwilioSetup();
  const { data: crmMetrics, isLoading: loadingMetrics } =
    useCRMDashboardMetrics();
  const { data: posAnalytics, isLoading: loadingPOSAnalytics } =
    usePOSAnalytics();

  const displayName = useMemo(() => {
    const fullName =
      typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : user?.email?.split("@")[0];

    return fullName?.split(" ")[0] || "there";
  }, [user?.email, user?.user_metadata]);

  // OnboardingGuard redirects incomplete users to /onboarding,
  // so if we reach the dashboard, onboarding is complete.
  // The setup wizard can still be opened manually via the "Complete Your Setup" button.

  // Check if user should see the quick start tour
  useEffect(() => {
    const tourDone = localStorage.getItem("dashboardTourDone");
    if (!tourDone && !showQuickTour) {
      // Show tour after a brief delay to let the page load
      setTimeout(() => {
        setShowQuickTour(true);
      }, 1000);
    }
  }, [showQuickTour]);

  // Show loading while checking onboarding status
  if (onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-gray-50/30">
        <div className="text-center">
          <CircularProgress size="md" sx={{ mb: 2 }} />
          <p className="text-primary font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const socialStatus = getConnectionStatus(socialConnections);
  const twilioStatus = getTwilioStatus(twilioData?.isSetup || false);
  const cardsLoading = loadingMetrics || loadingPOSAnalytics;

  const handleSelectAction = (action: string) => {
    switch (action) {
      case "website-setup":
        setShowSetupWizard(true);
        break;
      case "newsletter":
        navigate("/crm/campaigns/new?type=newsletter");
        break;
      case "social-post":
        setShowPostComposer(true);
        break;
      case "campaign":
        navigate("/crm/automations/new?mode=quick");
        break;
      case "content-calendar":
        navigate("/calendar");
        // Set flag for first-time calendar onboarding
        if (!localStorage.getItem("calendarOnboard")) {
          localStorage.setItem("calendarOnboard", "true");
        }
        break;
      case "dashboard":
      default:
        break;
    }
  };

  const quickActions = [
    {
      id: "newsletter",
      title: "Send a Newsletter",
      description:
        "Create an email campaign, review templates, and keep seasonal sends moving.",
      icon: Mail,
      primaryAction: {
        label: "Create newsletter",
        onClick: () => navigate("/newsletters/new"),
      },
      secondaryAction: {
        label: "View campaigns",
        onClick: () => navigate("/crm/campaigns"),
      },
    },
    {
      id: "create-flow",
      title: "Create Any Content",
      description:
        "Generate social posts, newsletters, and campaign ideas without leaving the dashboard.",
      icon: Sparkles,
      primaryAction: {
        label: "Open assistant",
        onClick: () => setShowCreateFlow(true),
      },
      secondaryAction: {
        label: "Browse content",
        onClick: () => navigate("/content/library"),
      },
    },
    {
      id: "campaign",
      title: "Build an Automation",
      description:
        "Design automated customer journeys with SMS and email sequences tied to customer behavior.",
      icon: Megaphone,
      primaryAction: {
        label: "Build campaign",
        onClick: () => navigate("/crm/automations/new?mode=quick"),
      },
      secondaryAction: {
        label: "View automations",
        onClick: () => navigate("/crm/automations"),
      },
    },
    {
      id: "social",
      title: "Post on Social Media",
      description:
        "Create, schedule, and publish content across your connected social channels.",
      icon: Share2,
      primaryAction: {
        label: "Create post",
        onClick: () => setShowPostComposer(true),
      },
      secondaryAction: {
        label: "Manage Accounts",
        onClick: () => navigate("/social-accounts"),
      },
    },
    {
      id: "planner",
      title: "Plan the Month",
      description:
        "Map campaigns, content, and timing for the next month from the planning workspace.",
      icon: Calendar,
      primaryAction: {
        label: "Open planner",
        onClick: () => navigate("/plan"),
      },
      secondaryAction: {
        label: "View calendar",
        onClick: () => navigate("/calendar"),
      },
    },
  ];

  const overviewStats = [
    {
      label: "Customers",
      value: cardsLoading
        ? "..."
        : (crmMetrics?.totalCustomers ?? 0).toLocaleString(),
      icon: <Mail />,
      change:
        crmMetrics && Number.isFinite(crmMetrics.totalCustomersGrowth)
          ? {
              value: `${Math.abs(crmMetrics.totalCustomersGrowth).toFixed(1)}% vs last month`,
              direction:
                crmMetrics.totalCustomersGrowth >= 0
                  ? ("up" as const)
                  : ("down" as const),
            }
          : undefined,
      onClick: () => navigate("/crm/customers"),
    },
    {
      label: "Orders",
      value: cardsLoading
        ? "..."
        : (posAnalytics?.totalOrders ?? 0).toLocaleString(),
      icon: <Calendar />,
      change: posAnalytics?.hasIntegration
        ? {
            value: `${posAnalytics.integrationName ?? "POS"} connected`,
            direction: "up" as const,
          }
        : undefined,
      onClick: () => navigate("/products"),
    },
    {
      label: "Active campaigns",
      value: cardsLoading
        ? "..."
        : (crmMetrics?.activeCampaigns ?? 0).toLocaleString(),
      icon: <Megaphone />,
      change:
        crmMetrics && Number.isFinite(crmMetrics.activeCampaignsGrowth)
          ? {
              value: `${Math.abs(crmMetrics.activeCampaignsGrowth).toFixed(1)}% vs last month`,
              direction:
                crmMetrics.activeCampaignsGrowth >= 0
                  ? ("up" as const)
                  : ("down" as const),
            }
          : undefined,
      onClick: () => navigate("/crm/campaigns"),
    },
    {
      label: "Revenue",
      value: cardsLoading
        ? "..."
        : new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(crmMetrics?.totalRevenue ?? 0),
      icon: <BarChart3 />,
      change:
        crmMetrics && Number.isFinite(crmMetrics.totalRevenueGrowth)
          ? {
              value: `${Math.abs(crmMetrics.totalRevenueGrowth).toFixed(1)}% vs last month`,
              direction:
                crmMetrics.totalRevenueGrowth >= 0
                  ? ("up" as const)
                  : ("down" as const),
            }
          : undefined,
      onClick: () => navigate("/analytics"),
    },
  ];

  const todayItems = [
    {
      label: "Social accounts",
      value: socialStatus.statusMessage,
      tone: socialStatus.status === "ready" ? "success" : "warning",
    },
    {
      label: "SMS readiness",
      value: twilioStatus.statusMessage,
      tone: twilioStatus.status === "ready" ? "success" : "warning",
    },
    {
      label: "POS sync",
      value: posAnalytics?.hasIntegration
        ? `${posAnalytics.integrationName ?? "POS"} connected`
        : "No POS integration connected",
      tone: posAnalytics?.hasIntegration ? "success" : "warning",
    },
    {
      label: "Website tools",
      value: "Website builder remains available from the workspace shell.",
      tone: "neutral",
    },
  ] as const;

  return (
    <Stack spacing={3.5}>
      <Sheet
        variant="plain"
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: "28px",
          border: "1px solid",
          borderColor: "neutral.200",
          background:
            "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(239, 246, 255, 0.88) 45%, rgba(255, 255, 255, 1) 100%)",
        }}
      >
        <Stack spacing={1.5}>
          <Typography
            level="body-sm"
            sx={{
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "primary.700",
              fontWeight: 700,
            }}
          >
            Tenant Dashboard
          </Typography>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", lg: "center" }}
          >
            <Stack spacing={1}>
              <Typography level="h1">Welcome back, {displayName}</Typography>
              <Typography level="body-md" color="neutral">
                Keep customers, campaigns, and store operations moving from one
                Joy dashboard.
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <JoyChip color="success" variant="soft">
                  Social{" "}
                  {loadingConnections ? "checking" : socialStatus.statusMessage}
                </JoyChip>
                <JoyChip
                  color={
                    loadingTwilio
                      ? "neutral"
                      : twilioStatus.status === "ready"
                        ? "success"
                        : "warning"
                  }
                  variant="soft"
                >
                  SMS {loadingTwilio ? "checking" : twilioStatus.statusMessage}
                </JoyChip>
              </Stack>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <JoyButton
                bloomVariant="outline"
                onClick={() => setShowLaunchpad(true)}
                startDecorator={<HelpCircle />}
              >
                Open launchpad
              </JoyButton>
              {!isCompleted && !hasEverCompleted ? (
                <JoyButton
                  onClick={() => setShowSetupWizard(true)}
                  startDecorator={<Sparkles />}
                >
                  Complete Setup
                </JoyButton>
              ) : null}
            </Stack>
          </Stack>
        </Stack>
      </Sheet>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
          gap: 3,
        }}
      >
        {overviewStats.map((stat) => (
          <JoyStatCard
            key={stat.label}
            icon={stat.icon}
            label={stat.label}
            value={stat.value}
            change={stat.change}
            onClick={stat.onClick}
          />
        ))}
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            xl: "minmax(0, 2fr) minmax(320px, 1fr)",
          },
          gap: 3,
        }}
      >
        <JoyCard>
          <JoyCardHeader
            title="What would you like to do today?"
            description="Jump straight into the most common tenant workflows."
          />
          <JoyCardContent>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  md: "repeat(2, minmax(0, 1fr))",
                },
                gap: 2,
              }}
            >
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <JoyCard
                    key={action.id}
                    variant="plain"
                    sx={{
                      borderColor: "neutral.200",
                      backgroundColor: "neutral.50",
                    }}
                  >
                    <JoyCardContent sx={{ pt: 3 }}>
                      <Stack spacing={2}>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="flex-start"
                        >
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: "16px",
                              display: "grid",
                              placeItems: "center",
                              backgroundColor: "primary.50",
                              color: "primary.700",
                              flexShrink: 0,
                            }}
                          >
                            <Icon className="h-5 w-5" />
                          </Box>
                          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                            <Typography level="title-sm">
                              {action.title}
                            </Typography>
                            <Typography level="body-sm" color="neutral">
                              {action.description}
                            </Typography>
                          </Stack>
                        </Stack>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1.25}
                        >
                          <JoyButton
                            size="sm"
                            onClick={action.primaryAction.onClick}
                          >
                            {action.primaryAction.label}
                          </JoyButton>
                          <JoyButton
                            bloomVariant="outline"
                            size="sm"
                            onClick={action.secondaryAction.onClick}
                          >
                            {action.secondaryAction.label}
                          </JoyButton>
                        </Stack>
                      </Stack>
                    </JoyCardContent>
                  </JoyCard>
                );
              })}
            </Box>
          </JoyCardContent>
        </JoyCard>

        <Stack spacing={3}>
          <JoyCard>
            <JoyCardHeader
              title="Today's focus"
              description="A quick tenant-level readiness check across the main channels."
            />
            <JoyCardContent>
              <Stack spacing={1.5}>
                {todayItems.map((item) => (
                  <Sheet
                    key={item.label}
                    variant="outlined"
                    sx={{
                      p: 1.75,
                      borderRadius: "16px",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 1.5,
                      alignItems: "center",
                    }}
                  >
                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                      <Typography level="title-sm">{item.label}</Typography>
                      <Typography level="body-xs" color="neutral">
                        {item.value}
                      </Typography>
                    </Stack>
                    <JoyChip color={item.tone} variant="soft">
                      {item.tone === "success"
                        ? "Ready"
                        : item.tone === "warning"
                          ? "Needs attention"
                          : "Info"}
                    </JoyChip>
                  </Sheet>
                ))}
              </Stack>
            </JoyCardContent>
          </JoyCard>

          <JoyCard>
            <JoyCardHeader
              title="Quick links"
              description="Tenant actions that are usually a click away after login."
            />
            <JoyCardContent>
              <Stack spacing={1}>
                {[
                  { label: "Open analytics", to: "/analytics" },
                  { label: "Review products", to: "/products" },
                  { label: "Update settings", to: "/settings" },
                  { label: "Website workspace", to: "/website/app" },
                ].map((item) => (
                  <JoyButton
                    key={item.to}
                    bloomVariant="ghost"
                    color="neutral"
                    onClick={() => navigate(item.to)}
                    sx={{ justifyContent: "space-between" }}
                  >
                    {item.label}
                    <ArrowRight className="h-4 w-4" />
                  </JoyButton>
                ))}
              </Stack>
            </JoyCardContent>
          </JoyCard>
        </Stack>
      </Box>

      <LaunchpadModal
        isOpen={showLaunchpad}
        onClose={() => setShowLaunchpad(false)}
        onSelectAction={handleSelectAction}
      />

      <PostComposerModal
        isOpen={showPostComposer}
        onClose={() => setShowPostComposer(false)}
      />

      <QuickStartTour
        isOpen={showQuickTour}
        onClose={() => setShowQuickTour(false)}
      />

      <CreateFlowDialog
        open={showCreateFlow}
        onOpenChange={setShowCreateFlow}
      />

      <DashboardSetupWizard
        isOpen={showSetupWizard}
        onClose={() => setShowSetupWizard(false)}
      />
    </Stack>
  );
};
