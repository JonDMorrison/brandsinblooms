import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, BookOpen, CheckCircle, ExternalLink } from "lucide-react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";

export default function GuidePage() {
  return (
    <Box sx={{ maxWidth: 800, mx: "auto", py: 4, px: 3 }}>
      <Stack spacing={4}>
        {/* Header */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Link to="/integrations/pos" style={{ textDecoration: "none" }}>
            <Button variant="plain" color="neutral" size="sm" startDecorator={<ArrowLeft style={{ width: 16, height: 16 }} />}>
              Back
            </Button>
          </Link>
          <Box>
            <Typography level="title-xl" fontWeight="xl">Clover Integration Guide</Typography>
            <Typography level="body-sm" textColor="text.tertiary">
              Learn how to connect and use your Clover POS integration
            </Typography>
          </Box>
        </Stack>

        {/* Getting Started */}
        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 3, bgcolor: "background.surface" }}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Box sx={{ flexShrink: 0, p: 1.25, borderRadius: "lg", bgcolor: "neutral.softBg" }}>
              <BookOpen style={{ width: 18, height: 18 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography level="title-md" fontWeight="xl" mb={1}>Getting Started</Typography>
              <Typography level="body-sm" textColor="text.secondary" mb={2}>
                The Clover integration connects your point-of-sale data with BloomSuite,
                enabling you to sync customers, track purchases, and automate marketing campaigns.
              </Typography>
              <Stack spacing={1.25}>
                {[
                  { label: "Automatic Customer Sync", desc: "Customer profiles from Clover sync automatically with your CRM." },
                  { label: "Purchase History", desc: "Track customer purchase history to create targeted marketing campaigns." },
                  { label: "Product Catalog", desc: "Your product inventory syncs for personalized recommendations." },
                ].map(({ label, desc }) => (
                  <Stack key={label} direction="row" spacing={1.5} alignItems="flex-start">
                    <CheckCircle style={{ width: 16, height: 16, color: "var(--joy-palette-success-500)", flexShrink: 0, marginTop: 2 }} />
                    <Box>
                      <Typography level="body-sm" fontWeight="md">{label}</Typography>
                      <Typography level="body-xs" textColor="text.tertiary">{desc}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Sheet>

        {/* Setup Instructions */}
        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 3, bgcolor: "background.surface" }}>
          <Typography level="title-md" fontWeight="xl" mb={2}>Setup Instructions</Typography>
          <Stack spacing={1.5}>
            {[
              {
                n: 1,
                title: "Create a Clover Developer Account",
                desc: "If you haven't already, create a developer account at the Clover Developer Portal.",
                link: { href: "https://sandbox.dev.clover.com", label: "Open Clover Developer Portal" },
              },
              {
                n: 2,
                title: "Connect Your Account",
                desc: "Click \u201cConnect Clover\u201d on the POS Integrations page and authorize BloomSuite to access your Clover data.",
              },
              {
                n: 3,
                title: "Complete the Setup Wizard",
                desc: "After connecting, the setup wizard will sync your data and help you configure automated marketing campaigns.",
              },
            ].map(({ n, title, desc, link }) => (
              <Sheet key={n} variant="soft" color="neutral" sx={{ borderRadius: "md", p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box sx={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", bgcolor: "neutral.700", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: "bold" }}>
                    {n}
                  </Box>
                  <Box>
                    <Typography level="body-sm" fontWeight="md">{title}</Typography>
                    <Typography level="body-xs" textColor="text.tertiary" mt={0.25}>{desc}</Typography>
                    {link && (
                      <Button
                        component="a"
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="plain"
                        color="primary"
                        size="sm"
                        endDecorator={<ExternalLink style={{ width: 12, height: 12 }} />}
                        sx={{ p: 0, mt: 0.75, minHeight: "unset" }}
                      >
                        {link.label}
                      </Button>
                    )}
                  </Box>
                </Stack>
              </Sheet>
            ))}
          </Stack>
        </Sheet>

        {/* FAQ */}
        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 3, bgcolor: "background.surface" }}>
          <Typography level="title-md" fontWeight="xl" mb={2}>Frequently Asked Questions</Typography>
          <Stack spacing={0.5}>
            {[
              {
                q: "How often does data sync?",
                a: "Data syncs automatically when you click \u201cSync Now\u201d from the integration panel. Future updates will include real-time webhooks for instant data updates when purchases occur in Clover.",
              },
              {
                q: "What data is synced from Clover?",
                a: "Customer names, emails, and phone numbers; marketing preferences and opt-in status; purchase history and order details; product catalog with categories.",
              },
              {
                q: "Which Clover regions are supported?",
                a: "BloomSuite supports Clover merchants in North America (US), Europe, and Latin America. The integration automatically detects your region during the OAuth flow.",
              },
              {
                q: "How do I disconnect my Clover account?",
                a: "Click the \u201cDisconnect\u201d button on the Clover integration card. This will remove the connection but won\u2019t delete any previously synced customer data from your CRM.",
              },
            ].map(({ q, a }) => (
              <Accordion key={q} sx={{ "& .MuiAccordionSummary-root": { px: 0 } }}>
                <AccordionSummary><Typography level="body-sm" fontWeight="md">{q}</Typography></AccordionSummary>
                <AccordionDetails><Typography level="body-sm" textColor="text.secondary">{a}</Typography></AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </Sheet>

        {/* Troubleshooting */}
        <Sheet variant="soft" color="warning" sx={{ borderRadius: "lg", p: 3 }}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <AlertCircle style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
            <Box>
              <Typography level="title-md" fontWeight="xl" mb={1}>Troubleshooting</Typography>
              <Stack spacing={0.75}>
                {[
                  ["Connection timeout", "If the OAuth flow times out, try again. Make sure popup blockers are disabled for this site."],
                  ["Missing permissions", "Ensure your Clover account has the necessary permissions to access customer and order data."],
                  ["Sync errors", "If syncing fails, try running the sync again. For persistent issues, contact support."],
                ].map(([label, desc]) => (
                  <Typography key={label} level="body-sm" textColor="text.secondary">
                    <strong>{label}:</strong> {desc}
                  </Typography>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Sheet>
      </Stack>
    </Box>
  );
}
