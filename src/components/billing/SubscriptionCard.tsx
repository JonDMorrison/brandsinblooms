import { useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Calendar, Clock } from "lucide-react";
import { toast } from "sonner";
import { CustomerPortalButton } from "@/components/subscription/CustomerPortalButton";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";

const planNames: Record<string, string> = {
  free_trial: "Free Trial",
  seed: "Seed",
  sprout: "Sprout",
  bloom: "Bloom",
  thrive: "Thrive",
  expired: "Expired",
};

const surfaceStyles = {
  borderRadius: "24px",
  borderColor: "divider",
  bgcolor: "background.surface",
  boxShadow: "sm",
  p: { xs: 2.5, sm: 3 },
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const formatBillingInterval = (value?: string | null) => {
  if (!value) {
    return "Monthly";
  }

  if (value === "year") {
    return "Annual";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const SubscriptionCard = () => {
  const { subscription, loading, trialDaysLeft, isTrialExpired } =
    useSubscription();
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const handleUpgrade = async (
    plan: "bloomsuite" = "bloomsuite",
    billingInterval: "year" = "year",
  ) => {
    setUpgradeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-checkout",
        {
          body: { plan, billingInterval },
        },
      );

      if (error) {
        throw error;
      }

      if (data?.url) {
        try {
          if (window.top) {
            window.top.location.href = data.url;
          } else {
            window.location.href = data.url;
          }
        } catch {
          window.open(data.url, "_blank", "noopener,noreferrer");
        }
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setUpgradeLoading(false);
    }
  };

  if (loading) {
    return (
      <Sheet variant="outlined" sx={surfaceStyles}>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="space-between"
          >
            <Stack spacing={1.25} sx={{ flex: 1 }}>
              <Skeleton variant="text" width={180} level="h2" />
              <Skeleton variant="text" width="45%" />
            </Stack>
            <Skeleton variant="rectangular" width={132} height={36} />
          </Stack>
          <Skeleton variant="rectangular" height={68} />
          <Divider />
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(3, minmax(0, 1fr))",
              },
            }}
          >
            <Skeleton variant="rectangular" height={56} />
            <Skeleton variant="rectangular" height={56} />
            <Skeleton variant="rectangular" height={56} />
          </Box>
        </Stack>
      </Sheet>
    );
  }

  if (!subscription) {
    return (
      <Sheet variant="outlined" sx={surfaceStyles}>
        <Stack
          spacing={2}
          alignItems="center"
          textAlign="center"
          sx={{ py: 3 }}
        >
          <Typography level="title-lg">No active plan</Typography>
          <Typography level="body-sm" textColor="text.secondary">
            Choose a plan to unlock billing, analytics, and account-level usage
            controls.
          </Typography>
          <Button
            color="neutral"
            loading={upgradeLoading}
            onClick={() => handleUpgrade()}
            size="sm"
            variant="outlined"
          >
            Choose a Plan
          </Button>
        </Stack>
      </Sheet>
    );
  }

  const effectivePlan = subscription.tier ?? subscription.plan;
  const isExpiredState = effectivePlan === "expired" || isTrialExpired;
  const isTrialPlan = effectivePlan === "free_trial" && !isExpiredState;
  const isPaidPlan = !isTrialPlan && !isExpiredState;
  const statusColor = isExpiredState
    ? "danger"
    : isTrialPlan
      ? "warning"
      : "success";
  const statusLabel = isExpiredState
    ? "Expired"
    : isTrialPlan
      ? `Trial${trialDaysLeft > 0 ? ` · ${trialDaysLeft} days left` : ""}`
      : "Active";

  return (
    <Sheet variant="outlined" sx={surfaceStyles}>
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Stack spacing={0.75}>
            <Typography level="title-lg">
              {planNames[effectivePlan] ?? "Subscription"}
            </Typography>
            <Typography level="body-sm" textColor="text.secondary">
              Manage your current plan, renewal cadence, and Stripe billing
              details.
            </Typography>
          </Stack>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.25}
            alignItems={{ sm: "center" }}
          >
            <Chip color={statusColor} size="sm" variant="soft">
              {statusLabel}
            </Chip>
            {isPaidPlan ? (
              <CustomerPortalButton size="sm" variant="outline" />
            ) : (
              <Button
                color="neutral"
                loading={upgradeLoading}
                onClick={() => handleUpgrade()}
                size="sm"
                variant={isExpiredState ? "solid" : "outlined"}
              >
                {isExpiredState ? "Reactivate" : "Upgrade"}
              </Button>
            )}
          </Stack>
        </Stack>

        {isTrialPlan ? (
          <Alert
            color="warning"
            size="sm"
            startDecorator={<Clock size={16} />}
            variant="soft"
          >
            Your trial ends on {formatDate(subscription.end_date)}. Upgrade
            before it expires to keep billing and account access uninterrupted.
          </Alert>
        ) : null}

        <Divider />

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
          }}
        >
          <Stack spacing={0.5}>
            <Typography level="body-xs" textColor="text.tertiary">
              Billing Interval
            </Typography>
            <Typography level="body-md" fontWeight={600}>
              {isTrialPlan
                ? "Trial"
                : formatBillingInterval(subscription.billing_interval)}
            </Typography>
          </Stack>
          <Stack spacing={0.5}>
            <Typography level="body-xs" textColor="text.tertiary">
              Start Date
            </Typography>
            <Typography level="body-md" fontWeight={600}>
              {formatDate(subscription.start_date)}
            </Typography>
          </Stack>
          <Stack spacing={0.5}>
            <Typography level="body-xs" textColor="text.tertiary">
              End Date
            </Typography>
            <Typography
              level="body-md"
              fontWeight={600}
              startDecorator={<Calendar size={16} />}
            >
              {formatDate(subscription.end_date)}
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </Sheet>
  );
};
