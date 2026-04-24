import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Award, Gift, Star, TrendingUp } from "lucide-react";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import type { LoyaltyDisplayMetrics } from "@/lib/customerDashboardTransformers";
import {
  clampPercent,
  formatCurrency,
  formatDateLabel,
} from "./customerDashboardUtils";

interface LoyaltyIncentivesImpactProps {
  metrics: LoyaltyDisplayMetrics;
}

const tiers = ["Bronze", "Silver", "Gold", "Platinum"];

export function LoyaltyIncentivesImpact({
  metrics,
}: LoyaltyIncentivesImpactProps) {
  const currentTierIndex = Math.max(
    tiers.findIndex(
      (tier) => tier.toLowerCase() === metrics.currentTier.toLowerCase(),
    ),
    0,
  );
  const perksRevenuePercentage =
    metrics.totalRevenue > 0
      ? Math.round((metrics.perksRevenue / metrics.totalRevenue) * 100)
      : 0;

  if (!metrics.isPerksEnrolled) {
    return (
      <JoyCard variant="outlined">
        <JoyCardHeader
          title="Loyalty & incentives"
          description="Perks enrollment, points behavior, and loyalty-driven revenue."
        />
        <JoyCardContent>
          <Sheet
            variant="soft"
            color="neutral"
            sx={{ borderRadius: "xl", p: 3, textAlign: "center" }}
          >
            <Stack spacing={1.5} alignItems="center">
              <Gift size={32} />
              <Typography level="title-md">
                Not enrolled in perks yet
              </Typography>
              <Typography level="body-sm" color="neutral">
                Loyalty enrollment is still an open opportunity for this
                customer.
              </Typography>
            </Stack>
          </Sheet>
        </JoyCardContent>
      </JoyCard>
    );
  }

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Loyalty & incentives"
        description="How points, redemptions, and tier progression are influencing purchase behavior."
      />
      <JoyCardContent>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <JoyChip
              color="warning"
              variant="soft"
              size="sm"
              startDecorator={<Star size={12} />}
            >
              {metrics.currentTier} member
            </JoyChip>
            {metrics.nextTier ? (
              <JoyChip color="neutral" variant="soft" size="sm">
                Next tier: {metrics.nextTier}
              </JoyChip>
            ) : null}
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(0, 1fr) minmax(0, 1fr)",
              },
              gap: 2,
            }}
          >
            <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
              <Stack spacing={1.5}>
                <Typography level="title-sm">Points activity</Typography>
                <Stack spacing={1}>
                  <Stack spacing={0.5}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography level="body-sm">Points earned</Typography>
                      <Typography level="body-xs" color="neutral">
                        {metrics.pointsEarned.toLocaleString()} pts
                      </Typography>
                    </Stack>
                    <LinearProgress
                      determinate
                      value={100}
                      color="success"
                      sx={{ borderRadius: 999 }}
                    />
                  </Stack>
                  <Stack spacing={0.5}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography level="body-sm">Points redeemed</Typography>
                      <Typography level="body-xs" color="neutral">
                        {metrics.pointsRedeemed.toLocaleString()} pts
                      </Typography>
                    </Stack>
                    <LinearProgress
                      determinate
                      value={
                        metrics.pointsEarned > 0
                          ? (metrics.pointsRedeemed / metrics.pointsEarned) *
                            100
                          : 0
                      }
                      color="warning"
                      sx={{ borderRadius: 999 }}
                    />
                  </Stack>
                </Stack>
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ borderRadius: "xl", p: 1.5 }}
                >
                  <Typography level="body-xs" color="neutral">
                    Current balance
                  </Typography>
                  <Typography level="title-lg">
                    {metrics.pointsBalance.toLocaleString()} pts
                  </Typography>
                </Sheet>
              </Stack>
            </Sheet>

            <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
              <Stack spacing={1.5}>
                <Typography level="title-sm">Perks-driven revenue</Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <CircularProgress
                    determinate
                    value={clampPercent(perksRevenuePercentage)}
                    color="warning"
                    size="lg"
                    sx={{
                      "--CircularProgress-size": "84px",
                      "--CircularProgress-thickness": "7px",
                    }}
                  >
                    <Typography level="title-sm">
                      {perksRevenuePercentage}%
                    </Typography>
                  </CircularProgress>
                  <Stack spacing={0.5}>
                    <Typography level="title-lg">
                      {formatCurrency(metrics.perksRevenue)}
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      of {formatCurrency(metrics.totalRevenue)} total revenue
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      Redemption frequency{" "}
                      {metrics.redemptionFrequency.toFixed(1)}
                    </Typography>
                  </Stack>
                </Stack>
              </Stack>
            </Sheet>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(0, 1.2fr) minmax(0, 0.8fr)",
              },
              gap: 2,
            }}
          >
            <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
              <Stack spacing={1.5}>
                <Typography level="title-sm">Tier progression</Typography>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  sx={{ position: "relative" }}
                >
                  <Box
                    sx={{
                      position: "absolute",
                      top: 18,
                      left: 10,
                      right: 10,
                      height: 2,
                      backgroundColor: "neutral.200",
                      zIndex: 0,
                    }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      top: 18,
                      left: 10,
                      height: 2,
                      width: `${((currentTierIndex + 1) / tiers.length) * 100}%`,
                      backgroundColor: "warning.400",
                      zIndex: 0,
                    }}
                  />
                  {tiers.map((tier, index) => {
                    const reached = index <= currentTierIndex;
                    const current = index === currentTierIndex;

                    return (
                      <Stack
                        key={tier}
                        spacing={0.5}
                        alignItems="center"
                        sx={{ zIndex: 1, flex: 1 }}
                      >
                        <Sheet
                          variant={reached ? "solid" : "soft"}
                          color={reached ? "warning" : "neutral"}
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 999,
                            display: "grid",
                            placeItems: "center",
                            boxShadow: current
                              ? "var(--joy-shadow-sm)"
                              : "none",
                          }}
                        >
                          <Award size={16} />
                        </Sheet>
                        <Typography
                          level="body-xs"
                          fontWeight={current ? "lg" : "md"}
                        >
                          {tier}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {metrics.pointsToNextTier !== null && metrics.nextTier ? (
                    <JoyChip color="neutral" variant="soft" size="sm">
                      {metrics.pointsToNextTier.toLocaleString()} pts to{" "}
                      {metrics.nextTier}
                    </JoyChip>
                  ) : (
                    <JoyChip color="neutral" variant="soft" size="sm">
                      Next-tier threshold unavailable
                    </JoyChip>
                  )}
                </Stack>
              </Stack>
            </Sheet>

            <Sheet variant="outlined" sx={{ borderRadius: "xl", p: 2 }}>
              <Stack spacing={1.25}>
                <Typography level="title-sm">Behavior signals</Typography>
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ borderRadius: "lg", p: 1.5 }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography level="body-sm">
                      Avg redemption delay
                    </Typography>
                    <Typography level="body-sm" fontWeight="lg">
                      {metrics.avgRedemptionDelay === null
                        ? "Data not available"
                        : `${metrics.avgRedemptionDelay} days`}
                    </Typography>
                  </Stack>
                </Sheet>
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ borderRadius: "lg", p: 1.5 }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography level="body-sm">Last redemption</Typography>
                    <Typography level="body-sm" fontWeight="lg">
                      {formatDateLabel(metrics.lastRedemptionAt)}
                    </Typography>
                  </Stack>
                </Sheet>
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ borderRadius: "lg", p: 1.5 }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Typography level="body-sm">Engagement lift</Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <TrendingUp size={14} />
                      <Typography level="body-sm" fontWeight="lg">
                        Loyalty active
                      </Typography>
                    </Stack>
                  </Stack>
                </Sheet>
              </Stack>
            </Sheet>
          </Box>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}

export default LoyaltyIncentivesImpact;
