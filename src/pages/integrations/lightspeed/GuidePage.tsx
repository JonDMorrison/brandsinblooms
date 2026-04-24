import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Gift,
  Tag,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";

const GuidePage = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", py: 4, px: 3 }}>
      <Stack spacing={4}>
        {/* Header */}
        <Button
          variant="plain"
          color="neutral"
          startDecorator={<ArrowLeft style={{ width: 16, height: 16 }} />}
          onClick={() => navigate("/integrations")}
          sx={{ alignSelf: "flex-start" }}
        >
          Back to Integrations
        </Button>

        <Box>
          <Typography level="h3" fontWeight="xl" mb={0.5}>Lightspeed Integration Guide</Typography>
          <Typography level="body-md" textColor="text.tertiary">
            Legacy guide for the Lightspeed Retail POS integration. Use the current dashboard and documentation for the latest implementation status.
          </Typography>
        </Box>

        {/* Planning Update Banner */}
        <Sheet variant="soft" color="warning" sx={{ borderRadius: "lg", p: 3 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Chip size="sm" color="warning" variant="soft" sx={{ textTransform: "uppercase", fontSize: 10, fontWeight: "bold", letterSpacing: 1 }}>
                Planning Update
              </Chip>
              <Typography level="body-sm" fontWeight="md">This page is preserved for bookmarked users.</Typography>
            </Stack>
            <Typography level="body-sm" textColor="text.secondary">
              Lightspeed connection, sync visibility, and diagnostics now live in the main integration shell. The automation examples below are planning references, not shipped trigger guarantees.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="sm" variant="solid" color="neutral" onClick={() => navigate("/integrations/lightspeed")}>
                Open Lightspeed Dashboard
              </Button>
              <Button size="sm" variant="outlined" color="neutral" onClick={() => navigate("/integrations/lightspeed/documentation")}>
                Open Documentation
              </Button>
            </Stack>
          </Stack>
        </Sheet>

        {/* What Gets Tracked */}
        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 3, bgcolor: "background.surface" }}>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
            <CheckCircle2 style={{ width: 18, height: 18, color: "var(--joy-palette-success-500)" }} />
            <Typography level="title-md" fontWeight="xl">What Gets Tracked</Typography>
          </Stack>
          <Stack spacing={1}>
            {[
              ["Customer Data", "Names, emails, phone numbers, and loyalty balances"],
              ["Purchase History", "All completed sales with transaction details"],
              ["Product Catalog", "Product names, SKUs, prices, and inventory levels"],
              ["Customer Groups", "Automatically mapped to CRM segments"],
              ["Loyalty Programs", "Points balances and membership status"],
            ].map(([label, desc]) => (
              <Stack key={label} direction="row" spacing={1.5} alignItems="flex-start">
                <Typography level="body-sm">✅</Typography>
                <Typography level="body-sm">
                  <strong>{label}</strong> — {desc}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Sheet>

        {/* Planned Automation Triggers */}
        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 3, bgcolor: "background.surface" }}>
          <Typography level="title-md" fontWeight="xl" mb={2}>Planned Automation Triggers</Typography>
          <Stack spacing={3}>
            {[
              {
                Icon: Gift,
                color: "neutral",
                label: "First Purchase Trigger",
                desc: "Planned welcome automation for customers after their first synced POS transaction.",
                uses: ["Thank you messages", "Loyalty program invitations", "First-purchase discount for next visit"],
              },
              {
                Icon: Clock,
                color: "primary",
                label: "90-Day Lapse Trigger",
                desc: "Planned win-back automation for customers who have not purchased in 90 days.",
                uses: ["\u201cWe miss you\u201d messages with special offers", "Comeback discounts (20% off)", "New product announcements"],
              },
              {
                Icon: TrendingUp,
                color: "neutral",
                label: "Loyalty Join Trigger",
                desc: "Planned automation for loyalty enrollment events captured through Lightspeed.",
                uses: ["Welcome bonus notifications", "Program benefits explanation", "How to earn and redeem points"],
              },
              {
                Icon: Tag,
                color: "success",
                label: "Plant Care Reminder (Tag-Based)",
                desc: "Planned tag-driven follow-up once Lightspeed product tagging and automation routing reach parity.",
                uses: ["Watering and care reminders", "Fertilizer recommendations", "Seasonal care tips"],
              },
              {
                Icon: Calendar,
                color: "danger",
                label: "Birthday Trigger",
                desc: "Planned birthday automation when Lightspeed profile data and trigger delivery are fully wired.",
                uses: ["Birthday discounts (20% off)", "Free item offers", "Special birthday surprises"],
              },
            ].map(({ Icon, label, desc, uses }) => (
              <Box key={label}>
                <Stack direction="row" spacing={1.5} alignItems="center" mb={0.5}>
                  <Icon style={{ width: 16, height: 16 }} />
                  <Typography level="body-sm" fontWeight="md">{label}</Typography>
                  <Chip size="sm" color="primary" variant="soft" sx={{ textTransform: "uppercase", fontSize: 9, fontWeight: "bold", letterSpacing: 0.5 }}>
                    Planned
                  </Chip>
                </Stack>
                <Typography level="body-sm" textColor="text.tertiary" mb={0.5} sx={{ ml: 3.5 }}>{desc}</Typography>
                <Stack component="ul" spacing={0.25} sx={{ pl: 5, m: 0 }}>
                  {uses.map((u) => (
                    <Typography key={u} component="li" level="body-xs" textColor="text.tertiary">{u}</Typography>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </Sheet>

        {/* Setup Instructions */}
        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 3, bgcolor: "background.surface" }}>
          <Typography level="title-md" fontWeight="xl" mb={2}>Setup Instructions</Typography>
          <Stack spacing={1.5}>
            {[
              ["Complete OAuth Connection", "If you see \"Connected\" on the integrations page, you're all set!"],
              ["Run Initial Sync", "Click \"Sync Now\" to pull your customer data, purchase history, and product catalog"],
              ["Track Planned Automation Readiness", "Use the Lightspeed dashboard and documentation to monitor current sync behavior while these automation triggers remain in planning."],
              ["Monitor Performance", "Check your Analytics dashboard to see campaign performance and ROI"],
            ].map(([label, desc], idx) => (
              <Stack key={label} direction="row" spacing={2} alignItems="flex-start">
                <Box sx={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", bgcolor: "neutral.softBg", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold" }}>
                  {idx + 1}
                </Box>
                <Box>
                  <Typography level="body-sm" fontWeight="md">{label}</Typography>
                  <Typography level="body-xs" textColor="text.tertiary">{desc}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Sheet>

        {/* Pro Tips */}
        <Sheet variant="soft" color="neutral" sx={{ borderRadius: "lg", p: 3 }}>
          <Typography level="title-sm" fontWeight="xl" mb={1}>💡 Pro Tips</Typography>
          <Stack spacing={0.75}>
            {[
              "Use the Lightspeed dashboard to verify customer, sales, and product sync status before planning campaigns.",
              "Treat the trigger examples above as roadmap references until the implementation is marked live in the main integration shell.",
              "Keep customer emails clean in Lightspeed so CRM normalization can link synced customers reliably.",
              "Check the documentation route for the latest operational notes and rollout status.",
            ].map((tip) => (
              <Typography key={tip} level="body-sm" textColor="text.secondary">• {tip}</Typography>
            ))}
          </Stack>
        </Sheet>

        <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
          <Button variant="solid" color="neutral" onClick={() => navigate("/integrations")}>
            Return to Integrations
          </Button>
        </Box>
      </Stack>
    </Box>
  );
};

export default GuidePage;
