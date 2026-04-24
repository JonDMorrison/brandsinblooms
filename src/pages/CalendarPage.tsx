import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Calendar } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CalendarView } from "@/components/CalendarView";
import { BackfillCampaigns } from "@/components/calendar/BackfillCampaigns";
import { GenerationProgressBanner } from "@/components/generation/GenerationProgressBanner";
import { ContentGenerationSkeleton } from "@/components/generation/ContentGenerationSkeleton";
import { PageContainer } from "@/components/joy/PageContainer";
import { PlanSuccessModal } from "@/components/plan/PlanSuccessModal";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalCalendarData } from "@/hooks/useGlobalCalendarData";
import { useGenerationJobTracker } from "@/state/useGenerationJobTracker";

const CalendarPage = () => {
  const { user } = useAuth();
  const { campaigns, loading, error, refetch, isCached } =
    useGlobalCalendarData();
  const { getJobsByType } = useGenerationJobTracker();
  const [searchParams] = useSearchParams();
  const [showPlanSuccessModal, setShowPlanSuccessModal] = useState(false);
  const [showWeeklyThemesModal, setShowWeeklyThemesModal] = useState(false);

  useEffect(() => {
    const planLaunched = searchParams.get("planLaunched");
    if (planLaunched !== "true") return;

    setShowPlanSuccessModal(true);
    const itemCount = searchParams.get("launchItems") || "0";
    const timer = window.setTimeout(() => {
      toast.success(`Plan scheduled successfully with ${itemCount} items`);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [searchParams]);

  const campaignJobs = getJobsByType("seasonal").concat(
    getJobsByType("holiday"),
  );
  const activeGenerationJobs = campaignJobs.filter(
    (job) => job.status === "generating",
  ).length;
  const shouldShowBackfill = campaigns.length > 0 && campaigns.length < 50;
  const campaignOverview = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let activeCampaigns = 0;
    let scheduledCampaigns = 0;
    let completedCampaigns = 0;

    for (const campaign of campaigns) {
      const startDate = campaign.start_date
        ? new Date(campaign.start_date)
        : null;
      const endDate = campaign.end_date
        ? new Date(campaign.end_date)
        : startDate;

      startDate?.setHours(0, 0, 0, 0);
      endDate?.setHours(0, 0, 0, 0);

      if (startDate && startDate > today) {
        scheduledCampaigns += 1;
        continue;
      }

      if (endDate && endDate < today) {
        completedCampaigns += 1;
        continue;
      }

      activeCampaigns += 1;
    }

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns,
      scheduledCampaigns,
      completedCampaigns,
      activeGenerationJobs,
    };
  }, [activeGenerationJobs, campaigns]);

  if (!user) {
    return (
      <PageContainer sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
        <Sheet
          variant="outlined"
          sx={{
            minHeight: 320,
            display: "grid",
            placeItems: "center",
            borderRadius: "xl",
            px: 3,
            py: 4,
            textAlign: "center",
          }}
        >
          <Stack spacing={1.5} alignItems="center">
            <Calendar size={28} />
            <Typography level="h3">
              Please log in to access your calendar
            </Typography>
          </Stack>
        </Sheet>
      </PageContainer>
    );
  }

  if (loading && !isCached) {
    return (
      <PageContainer sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
        <Sheet
          variant="outlined"
          sx={{
            minHeight: 320,
            display: "grid",
            placeItems: "center",
            borderRadius: "xl",
            px: 3,
            py: 4,
          }}
        >
          <Stack spacing={2} alignItems="center">
            <CircularProgress size="lg" />
            <Stack spacing={0.5} alignItems="center">
              <Typography level="h3">Loading calendar</Typography>
              <Typography level="body-sm" color="neutral">
                Preparing your planning surface and campaign schedule.
              </Typography>
            </Stack>
          </Stack>
        </Sheet>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
        <Sheet
          variant="outlined"
          sx={{
            minHeight: 320,
            display: "grid",
            placeItems: "center",
            borderRadius: "xl",
            px: 3,
            py: 4,
          }}
        >
          <Stack
            spacing={2}
            alignItems="center"
            sx={{ maxWidth: 420, textAlign: "center" }}
          >
            <Alert
              color="danger"
              variant="soft"
              sx={{ width: "100%", justifyContent: "center" }}
            >
              Error loading calendar
            </Alert>
            <Typography level="body-sm" color="neutral">
              {error}
            </Typography>
            <Button onClick={() => void refetch()} color="danger">
              Try again
            </Button>
          </Stack>
        </Sheet>
      </PageContainer>
    );
  }

  return (
    <>
      <PageContainer sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
        <Stack spacing={2.5}>
          <CalendarView
            campaignOverview={campaignOverview}
            headerSupplement={
              <>
                <GenerationProgressBanner />

                {activeGenerationJobs > 0 ? (
                  <ContentGenerationSkeleton
                    type="campaign"
                    count={activeGenerationJobs}
                  />
                ) : null}

                {shouldShowBackfill ? (
                  <BackfillCampaigns
                    currentCampaignCount={campaigns.length}
                    onBackfillComplete={() => {
                      void refetch();
                    }}
                  />
                ) : null}
              </>
            }
            onDataUpdate={() => {
              void refetch();
            }}
            showWeeklyThemesModal={showWeeklyThemesModal}
            onCloseWeeklyThemesModal={() => setShowWeeklyThemesModal(false)}
          />
        </Stack>
      </PageContainer>

      <PlanSuccessModal
        open={showPlanSuccessModal}
        onOpenChange={setShowPlanSuccessModal}
      />
    </>
  );
};

export default CalendarPage;
