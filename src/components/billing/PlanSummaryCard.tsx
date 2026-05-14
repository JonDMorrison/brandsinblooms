import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Check, Globe, Mail, MessageSquare, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { JoyButton } from "@/components/joy/JoyButton";
import { pricingTiers } from "@/components/pricing/pricingConfig";

const surfaceStyles = {
  borderRadius: "24px",
  borderColor: "divider",
  bgcolor: "background.surface",
  boxShadow: "sm",
  p: { xs: 2.5, sm: 3 },
};

// What the user effectively gets at a glance. The card consumes the
// canonical pricingTiers definition so the marketing site (PricingPage
// → PricingCardsGrid) and the billing tab stay in lockstep — change a
// tier's email/SMS allowance in pricingConfig.ts and both surfaces
// move together.
export const PlanSummaryCard = () => {
  const { subscription, loading } = useSubscription();
  const navigate = useNavigate();
  const goToPricing = () => navigate("/pricing");

  if (loading) {
    return (
      <Sheet variant="outlined" sx={surfaceStyles}>
        <Stack spacing={2}>
          <Skeleton variant="text" width={160} level="title-lg" />
          <Skeleton variant="text" width="60%" />
          <Divider />
          <Stack spacing={1.25}>
            <Skeleton variant="rectangular" height={20} />
            <Skeleton variant="rectangular" height={20} />
            <Skeleton variant="rectangular" height={20} />
          </Stack>
        </Stack>
      </Sheet>
    );
  }

  const effectivePlan = subscription?.tier ?? subscription?.plan ?? null;
  const tier =
    effectivePlan && effectivePlan !== "free_trial" && effectivePlan !== "expired"
      ? pricingTiers.find((t) => t.id === effectivePlan) ?? null
      : null;
  const isTrial = effectivePlan === "free_trial";
  const isExpired = effectivePlan === "expired";

  // For free_trial / expired / legacy bloomsuite — no marketing tier
  // matches. Show a generic "what comes with paid plans" CTA card.
  if (!tier) {
    return (
      <Sheet variant="outlined" sx={surfaceStyles} data-testid="plan-summary-card">
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography level="title-lg">What's included</Typography>
            <Typography level="body-sm" textColor="text.secondary">
              {isExpired
                ? "Your subscription has lapsed. Pick a plan to restore feature access and quotas."
                : isTrial
                  ? "You're on the free trial. Upgrade to lock in email and SMS quotas, automations, and the full BloomSuite feature set."
                  : "Choose a tier to see exactly what email and SMS volume your plan includes."}
            </Typography>
          </Stack>
          <JoyButton
            color="primary"
            size="sm"
            onClick={goToPricing}
            sx={{ alignSelf: "flex-start" }}
          >
            View pricing
          </JoyButton>
        </Stack>
      </Sheet>
    );
  }

  // Paid tier: render the headline benefits straight from
  // pricingConfig so we don't drift from the public copy.
  const features: Array<{ icon: React.ReactNode; label: string }> = [
    { icon: <Mail size={14} />, label: tier.includes.emails },
    { icon: <MessageSquare size={14} />, label: tier.includes.sms },
  ];
  if (tier.includes.website) {
    features.push({
      icon: <Globe size={14} />,
      label: "Website + Ecommerce storefront",
    });
  }
  features.push({
    icon: <Sparkles size={14} />,
    label: "Garden centre CRM with prebuilt personas",
  });

  return (
    <Sheet variant="outlined" sx={surfaceStyles} data-testid="plan-summary-card">
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Stack spacing={0.5}>
            <Typography level="title-lg">What's included with {tier.name}</Typography>
            <Typography level="body-sm" textColor="text.secondary">
              {tier.description}
            </Typography>
          </Stack>
          <Chip color="primary" size="sm" variant="soft">
            {tier.name} tier
          </Chip>
        </Stack>

        <Divider />

        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
            },
          }}
        >
          {features.map(({ icon, label }) => (
            <Stack
              key={label}
              direction="row"
              spacing={1}
              alignItems="flex-start"
              sx={{
                p: 1.25,
                borderRadius: "12px",
                bgcolor: "background.level1",
              }}
            >
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 24,
                  height: 24,
                  borderRadius: "999px",
                  bgcolor: "primary.softBg",
                  color: "primary.solidBg",
                  flexShrink: 0,
                }}
              >
                <Check size={14} />
              </Box>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Box sx={{ color: "text.tertiary", display: "inline-flex" }}>
                  {icon}
                </Box>
                <Typography level="body-sm">{label}</Typography>
              </Stack>
            </Stack>
          ))}
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ sm: "center" }}
          justifyContent="space-between"
        >
          <Typography level="body-xs" textColor="text.tertiary">
            Overages — email {tier.overages.emails} · SMS {tier.overages.sms}
          </Typography>
          <JoyButton
            color="neutral"
            bloomVariant="ghost"
            size="sm"
            onClick={goToPricing}
          >
            Compare plans
          </JoyButton>
        </Stack>
      </Stack>
    </Sheet>
  );
};
