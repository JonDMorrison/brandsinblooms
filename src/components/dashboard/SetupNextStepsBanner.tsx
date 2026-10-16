import { useState } from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useNavigate } from "react-router-dom";
import { JoyButton } from "@/components/joy/JoyButton";
import { dashboardCardSpacing } from "@/components/dashboard/dashboardCardSpacing";
import { useTenant } from "@/hooks/useTenant";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Globe, Users, Mail, X } from "lucide-react";

interface SetupStep {
  key: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  cta: string;
}

export function SetupNextStepsBanner() {
  const { tenant } = useTenant();
  const { hasPermission, role } = useUserRole();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("setup-banner-dismissed") === "1",
  );

  const { data: setupState } = useQuery({
    queryKey: ["setup-next-steps", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;

      const [domainRes, contactRes, campaignRes] = await Promise.all([
        supabase
          .from("email_domains")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .eq("status", "active"),
        supabase
          .from("crm_customers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id),
        supabase
          .from("crm_campaigns")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .in("status", ["sent", "sending", "completed"]),
      ]);

      return {
        hasDomain: (domainRes.count ?? 0) > 0,
        hasContacts: (contactRes.count ?? 0) > 0,
        hasCampaign: (campaignRes.count ?? 0) > 0,
      };
    },
    enabled: !!tenant?.id,
    staleTime: 120_000,
  });

  if (dismissed || !setupState) return null;
  if (setupState.hasDomain && setupState.hasContacts && setupState.hasCampaign)
    return null;

  const steps: SetupStep[] = [];

  if (!setupState.hasDomain && hasPermission("integrations.manage")) {
    steps.push({
      key: "domain",
      icon: <Globe size={18} />,
      title: "Connect your sending domain",
      description:
        "Required to send emails to your customers. Takes about 5 minutes.",
      href: "/crm/settings/email-sending",
      cta: "Set up domain",
    });
  }
  if (!setupState.hasContacts && (role === "owner_admin" || role === "marketing")) {
    steps.push({
      key: "contacts",
      icon: <Users size={18} />,
      title: "Import your customer list",
      description:
        "Upload contacts or connect your POS to start building audiences.",
      href: "/crm/customers?import=1",
      cta: "Import contacts",
    });
  }
  if (!setupState.hasCampaign && hasPermission("campaigns.write")) {
    steps.push({
      key: "campaign",
      icon: <Mail size={18} />,
      title: "Send your first email campaign",
      description:
        "Your content library is ready — pick a template and send.",
      // Route to the newsletter picker (NewsletterNewPage at
      // /newsletters/new) where users choose Start from Scratch /
      // Pick an Idea / template — same destination the Getting
      // Started "Send My First Newsletter" card was pointed at in
      // commit 20126d26. /crm/campaigns/new mounts
      // CRMCampaignEditorPage directly, which IS the blank editor
      // we're trying to avoid dropping users into.
      href: "/newsletters/new",
      cta: "Create campaign",
    });
  }

  // Show only the first incomplete step
  const step = steps[0];
  if (!step) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("setup-banner-dismissed", "1");
  };

  return (
    <Box
      data-dashboard-setup-banner
      sx={{
        borderRadius: "lg",
        border: "1px solid",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        px: dashboardCardSpacing.banner.px,
        py: dashboardCardSpacing.banner.py,
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={{ xs: 2.5, md: 3 }}
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <Stack
          direction="row"
          spacing={dashboardCardSpacing.banner.iconGap}
          alignItems="center"
          sx={{ flex: 1, minWidth: 0 }}
        >
          <Box
            data-dashboard-setup-icon
            sx={{
              display: "grid",
              placeItems: "center",
              width: dashboardCardSpacing.banner.iconSize,
              height: dashboardCardSpacing.banner.iconSize,
              borderRadius: dashboardCardSpacing.banner.iconRadius,
              backgroundColor: "neutral.100",
              color: "neutral.700",
              flexShrink: 0,
            }}
          >
            {step.icon}
          </Box>
          <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              level="title-md"
              sx={{
                fontWeight: 600,
                color: "neutral.900",
                fontSize: "1rem",
                lineHeight: 1.4,
              }}
            >
              {step.title}
            </Typography>
            <Typography
              level="body-sm"
              sx={{ color: "neutral.600", lineHeight: 1.5 }}
            >
              {step.description}
            </Typography>
          </Stack>
        </Stack>
        <Stack
          direction="row"
          spacing={dashboardCardSpacing.banner.actionGap}
          alignItems="center"
          sx={{
            pl: { xs: 0, sm: 8, md: 0 },
            width: { xs: "100%", md: "auto" },
            justifyContent: { xs: "space-between", sm: "flex-start", md: "flex-end" },
            flexShrink: 0,
          }}
        >
          <JoyButton
            size="md"
            onClick={() => navigate(step.href)}
            sx={{
              minHeight: dashboardCardSpacing.banner.minButtonHeight,
              flexShrink: 0,
            }}
          >
            {step.cta}
          </JoyButton>
          <Box
            component="button"
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss setup reminder"
            sx={{
              appearance: "none",
              border: "none",
              backgroundColor: "transparent",
              color: "neutral.500",
              cursor: "pointer",
              width: 40,
              height: 40,
              display: "grid",
              placeItems: "center",
              borderRadius: "md",
              flexShrink: 0,
              "&:hover": { color: "neutral.800", backgroundColor: "neutral.100" },
              "&:focus-visible": {
                outline: "2px solid var(--joy-palette-primary-400)",
                outlineOffset: 2,
              },
            }}
          >
            <X size={18} aria-hidden="true" />
          </Box>
        </Stack>
      </Stack>
      {steps.length > 1 ? (
        <Typography
          level="body-xs"
          sx={{
            color: "neutral.600",
            mt: 1.5,
            ml: { xs: 0, sm: 8 },
          }}
        >
          {steps.length - 1} more setup step{steps.length > 2 ? "s" : ""}{" "}
          remaining
        </Typography>
      ) : null}
    </Box>
  );
}
