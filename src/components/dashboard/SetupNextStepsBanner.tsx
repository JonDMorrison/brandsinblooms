import { useState } from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useNavigate } from "react-router-dom";
import { JoyButton } from "@/components/joy/JoyButton";
import { useTenant } from "@/hooks/useTenant";
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

  if (!setupState.hasDomain) {
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
  if (!setupState.hasContacts) {
    steps.push({
      key: "contacts",
      icon: <Users size={18} />,
      title: "Import your customer list",
      description:
        "Upload contacts or connect your POS to start building audiences.",
      href: "/crm/contacts",
      cta: "Import contacts",
    });
  }
  if (!setupState.hasCampaign) {
    steps.push({
      key: "campaign",
      icon: <Mail size={18} />,
      title: "Send your first email campaign",
      description:
        "Your content library is ready — pick a template and send.",
      href: "/crm/campaigns/new",
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
      sx={{
        position: "relative",
        borderRadius: "12px",
        border: "1px solid",
        borderColor: "neutral.200",
        background:
          "linear-gradient(135deg, rgba(104, 190, 185, 0.08) 0%, rgba(104, 190, 185, 0.02) 100%)",
        px: 2.5,
        py: 2,
      }}
    >
      <Box
        component="button"
        onClick={handleDismiss}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          appearance: "none",
          border: "none",
          background: "none",
          cursor: "pointer",
          color: "neutral.400",
          p: 0.5,
          borderRadius: "4px",
          "&:hover": { color: "neutral.600", background: "neutral.100" },
        }}
      >
        <X size={14} />
      </Box>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "8px",
            backgroundColor: "#68BEB9",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          {step.icon}
        </Box>
        <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{ fontSize: "14px", fontWeight: 600, color: "neutral.800" }}
          >
            {step.title}
          </Typography>
          <Typography sx={{ fontSize: "12px", color: "neutral.500" }}>
            {step.description}
          </Typography>
        </Stack>
        <JoyButton
          size="sm"
          onClick={() => navigate(step.href)}
          sx={{
            flexShrink: 0,
            backgroundColor: "#68BEB9",
            "&:hover": { backgroundColor: "#4FA8A3" },
          }}
        >
          {step.cta}
        </JoyButton>
      </Stack>
      {steps.length > 1 && (
        <Typography
          sx={{
            fontSize: "11px",
            color: "neutral.400",
            mt: 1,
            pl: "52px",
          }}
        >
          {steps.length - 1} more setup step{steps.length > 2 ? "s" : ""}{" "}
          remaining
        </Typography>
      )}
    </Box>
  );
}
