import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";

interface UsageWarningBannerProps {
  className?: string;
  dismissible?: boolean;
}

export const UsageWarningBanner = ({ className, dismissible = true }: UsageWarningBannerProps) => {
  const { usage, loading, getThresholds, getUpgradeRecommendation } = useUsageTracking();
  const [dismissed, setDismissed] = useState(false);

  if (loading || !usage || dismissed) return null;

  const thresholds = getThresholds();
  const recommendation = getUpgradeRecommendation();

  // Don't show if not at any threshold
  if (!thresholds.anyAt80) return null;

  const isAtLimit = thresholds.anyAt100;
  const bannerColor = isAtLimit ? "danger" : "warning";

  const getMessage = () => {
    if (thresholds.emailAt100 && thresholds.smsAt100) {
      return "You've reached both your email and SMS limits for this month.";
    }
    if (thresholds.emailAt100) {
      return "You've reached your email limit for this month.";
    }
    if (thresholds.smsAt100) {
      return "You've reached your SMS limit for this month.";
    }
    if (thresholds.emailAt80 && thresholds.smsAt80) {
      return `You're at ${Math.round(usage.email.percent)}% email and ${Math.round(usage.sms.percent)}% SMS usage.`;
    }
    if (thresholds.emailAt80) {
      return `You've used ${Math.round(usage.email.percent)}% of your email quota.`;
    }
    if (thresholds.smsAt80) {
      return `You've used ${Math.round(usage.sms.percent)}% of your SMS quota.`;
    }
    return '';
  };

  const title = isAtLimit ? "Usage limit reached" : "Approaching usage limit";
  const secondaryLine = recommendation.suggestedTier
    ? `Upgrade to ${recommendation.suggestedTier} for more capacity.`
    : undefined;

  return (
    <Alert
      className={className}
      color={bannerColor}
      size="md"
      startDecorator={<AlertTriangle size={20} />}
      variant="soft"
      endDecorator={
        <Stack direction="row" spacing={1} alignItems="center">
          <JoyButton
            color={bannerColor}
            component={RouterLink}
            size="sm"
            to="/pricing"
            variant="solid"
          >
            Upgrade Plan
          </JoyButton>
          {dismissible ? (
            <IconButton
              color={bannerColor}
              onClick={() => setDismissed(true)}
              size="sm"
              variant="plain"
            >
              <X size={16} />
            </IconButton>
          ) : null}
        </Stack>
      }
      sx={{
        borderRadius: "20px",
        alignItems: "flex-start",
        bgcolor: "background.surface",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography fontWeight={600} level="title-sm">
          {title}
        </Typography>
        <Typography level="body-sm" sx={{ mt: 0.5 }}>
          {getMessage()}
        </Typography>
        {secondaryLine ? (
          <Typography level="body-xs" sx={{ mt: 0.75, color: "text.tertiary" }}>
            {secondaryLine}
          </Typography>
        ) : null}
      </Box>
    </Alert>
  );
};
