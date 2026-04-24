import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Gift,
  Medal,
  Plug,
  RefreshCw,
  ShoppingCart,
  Star,
  TrendingUp,
  UserPlus,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Sheet,
  Stack,
  Table,
  Typography,
} from "@mui/joy";

const SquareGuidePage = () => {
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

        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ p: 1.5, borderRadius: "xl", bgcolor: "neutral.softBg", flexShrink: 0 }}>
            <Plug style={{ width: 24, height: 24 }} />
          </Box>
          <Box>
            <Typography level="h3" fontWeight="xl" mb={0.25}>Square Integration Guide</Typography>
            <Typography level="body-sm" textColor="text.tertiary">Complete setup guide for connecting Square POS with BloomSuite</Typography>
          </Box>
        </Stack>

        {/* Prerequisites */}
        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 3, bgcolor: "background.surface", borderLeft: "4px solid", borderLeftColor: "primary.300" }}>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
            <AlertCircle style={{ width: 18, height: 18 }} />
            <Typography level="title-md" fontWeight="xl">Prerequisites</Typography>
          </Stack>
          <Stack spacing={1}>
            {[
              "A Square account (Business account recommended for full features)",
              "Admin access to your Square account",
              "At least one location configured in Square",
            ].map((item) => (
              <Stack key={item} direction="row" spacing={1.5} alignItems="center">
                <CheckCircle2 style={{ width: 14, height: 14, color: "var(--joy-palette-success-500)", flexShrink: 0 }} />
                <Typography level="body-sm">{item}</Typography>
              </Stack>
            ))}
          </Stack>
        </Sheet>

        {/* Step-by-Step */}
        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 3, bgcolor: "background.surface" }}>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={2.5}>
            <BookOpen style={{ width: 18, height: 18 }} />
            <Typography level="title-md" fontWeight="xl">Step-by-Step Setup</Typography>
          </Stack>
          <Stack spacing={2}>
            {[
              {
                title: "Navigate to Integrations Hub",
                desc: "Go to Settings \u2192 Integrations from the sidebar menu. Find the \u201cSquare\u201d card in the POS Integrations section.",
              },
              {
                title: "Click \u201cConnect Square\u201d",
                desc: "Click the blue \u201cConnect Square\u201d button. A new window will open directing you to Square\u2019s authorization page.",
              },
              {
                title: "Authorize BloomSuite",
                desc: "Log in to your Square account if prompted, then click \u201cAllow\u201d to grant BloomSuite access to your customer data, transactions, and loyalty information.",
                note: "Permissions granted: Customers (read), Orders (read), Loyalty (read), Merchants (read)",
              },
              {
                title: "Confirm Connection",
                desc: "The window will close automatically. You\u2019ll see a green checkmark and \u201cConnected\u201d status on the Square card.",
              },
              {
                title: "Run Initial Sync",
                desc: "Click \u201cSync Now\u201d to pull your customers, sales history, and products from Square. This may take a few minutes depending on your data volume.",
              },
            ].map(({ title, desc, note }, idx) => (
              <Stack key={title} direction="row" spacing={2} alignItems="flex-start">
                <Box sx={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", bgcolor: "neutral.700", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: "bold" }}>
                  {idx + 1}
                </Box>
                <Box>
                  <Typography level="body-sm" fontWeight="md" mb={0.25}>{title}</Typography>
                  <Typography level="body-xs" textColor="text.secondary">{desc}</Typography>
                  {note && (
                    <Sheet variant="soft" color="neutral" sx={{ borderRadius: "sm", px: 1.5, py: 0.75, mt: 0.75 }}>
                      <Typography level="body-xs" textColor="text.secondary"><strong>Permissions:</strong> {note}</Typography>
                    </Sheet>
                  )}
                </Box>
              </Stack>
            ))}
          </Stack>
        </Sheet>

        {/* What Gets Synced */}
        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 3, bgcolor: "background.surface" }}>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
            <RefreshCw style={{ width: 18, height: 18, color: "var(--joy-palette-success-500)" }} />
            <Typography level="title-md" fontWeight="xl">What Gets Synced</Typography>
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
            {[
              ["Customer Data", "Names, emails, phones, group memberships"],
              ["Purchase History", "Orders, amounts, dates, items purchased"],
              ["Marketing Preferences", "Email opt-in status from Square preferences"],
              ["Customer Groups \u2192 Tags", "Square groups become BloomSuite tags"],
              ["Customer Metrics", "Lifetime value, total spent, purchase dates"],
              ["Products Catalog", "SKUs, names, prices, categories"],
            ].map(([label, desc]) => (
              <Stack key={label} direction="row" spacing={1.5} alignItems="flex-start">
                <CheckCircle2 style={{ width: 14, height: 14, color: "var(--joy-palette-success-500)", flexShrink: 0, marginTop: 3 }} />
                <Box>
                  <Typography level="body-sm" fontWeight="md">{label}</Typography>
                  <Typography level="body-xs" textColor="text.tertiary">{desc}</Typography>
                </Box>
              </Stack>
            ))}
          </Box>
        </Sheet>

        {/* Data Mapping */}
        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 3, bgcolor: "background.surface" }}>
          <Typography level="title-md" fontWeight="xl" mb={2}>Customer Data Mapping</Typography>
          <Table size="sm" borderAxis="xBetween">
            <thead>
              <tr>
                <th>Square Field</th>
                <th>BloomSuite Field</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["given_name", "first_name"],
                ["family_name", "last_name"],
                ["email_address", "email"],
                ["phone_number", "phone"],
                ["group_ids", "tags (array)"],
                ["preferences.email_unsubscribed", "email_opt_in (inverted)"],
                ["birthday", "custom_fields.date_of_birth"],
              ].map(([sq, bs]) => (
                <tr key={sq}>
                  <td><Typography level="body-xs" textColor="text.tertiary">{sq}</Typography></td>
                  <td><Typography level="body-xs">{bs}</Typography></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Sheet>

        {/* Real-Time Webhooks */}
        <Sheet variant="soft" color="neutral" sx={{ borderRadius: "lg", p: 3 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
            <Zap style={{ width: 18, height: 18, color: "var(--joy-palette-warning-500)" }} />
            <Typography level="title-md" fontWeight="xl">Real-Time Webhooks</Typography>
          </Stack>
          <Typography level="body-sm" textColor="text.secondary" mb={2}>
            When connected, Square sends real-time updates to BloomSuite. This means:
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            {[
              { Icon: ShoppingCart, label: "Instant Purchase Detection", desc: "Automations trigger immediately after checkout" },
              { Icon: UserPlus, label: "New Customer Alerts", desc: "Welcome sequences start automatically" },
            ].map(({ Icon, label, desc }) => (
              <Sheet key={label} variant="outlined" sx={{ borderRadius: "md", p: 2, flex: 1, minWidth: 160, bgcolor: "background.surface" }}>
                <Stack direction="row" spacing={1.5} alignItems="center" mb={0.5}>
                  <Icon style={{ width: 16, height: 16, color: "var(--joy-palette-success-500)" }} />
                  <Typography level="body-sm" fontWeight="md">{label}</Typography>
                </Stack>
                <Typography level="body-xs" textColor="text.tertiary">{desc}</Typography>
              </Sheet>
            ))}
          </Stack>
          <Typography level="body-xs" textColor="text.tertiary" mt={1.5}>No manual sync needed for new purchases — they flow automatically!</Typography>
        </Sheet>

        {/* Automation Triggers */}
        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 3, bgcolor: "background.surface" }}>
          <Typography level="title-md" fontWeight="xl" mb={2.5}>Available Automation Triggers</Typography>
          <Stack spacing={2.5}>
            {[
              { Icon: Gift, label: "First Purchase", desc: "Triggers when a customer makes their very first purchase at your store", uses: ["Welcome thank-you messages", "Loyalty program invitations", "First-purchase discount for next visit"] },
              { Icon: ShoppingCart, label: "Order Completed", desc: "Fires for every completed purchase via webhook", uses: ["Order confirmation emails", "Product care tips based on items purchased", "Cross-sell recommendations"] },
              { Icon: Star, label: "Review Request", desc: "Automatically scheduled 5 days after a purchase", uses: ["Google review requests", "Product feedback collection", "Testimonial gathering"] },
              { Icon: UserPlus, label: "Customer Created", desc: "Triggers when a new customer profile is created in Square", uses: ["Welcome to the community messages", "First-time visitor offers", "Newsletter signups"] },
              { Icon: Medal, label: "Loyalty Join", desc: "Fires when a customer joins your Square Loyalty program", uses: ["Welcome bonus notifications", "Program benefits explanation", "How to earn and redeem points"] },
              { Icon: Calendar, label: "Birthday", desc: "Sends birthday messages when birthday is stored in customer profile", uses: ["Birthday discounts (20% off)", "Free item offers", "Special birthday surprises"] },
              { Icon: Clock, label: "90-Day Lapse", desc: "Detects customers who haven\u2019t purchased in 90 days", uses: ["\u201cWe miss you\u201d messages with special offers", "Comeback discounts", "New product announcements"] },
            ].map(({ Icon, label, desc, uses }) => (
              <Box key={label}>
                <Stack direction="row" spacing={1.5} alignItems="center" mb={0.5}>
                  <Icon style={{ width: 15, height: 15 }} />
                  <Typography level="body-sm" fontWeight="md">{label}</Typography>
                </Stack>
                <Typography level="body-xs" textColor="text.tertiary" mb={0.5} sx={{ ml: 3.5 }}>{desc}</Typography>
                <Stack component="ul" spacing={0.25} sx={{ pl: 5, m: 0 }}>
                  {uses.map((u) => (
                    <Typography key={u} component="li" level="body-xs" textColor="text.tertiary">{u}</Typography>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </Sheet>

        {/* FAQ */}
        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 3, bgcolor: "background.surface" }}>
          <Typography level="title-md" fontWeight="xl" mb={2}>Troubleshooting</Typography>
          <Stack spacing={0.5}>
            {[
              { q: "Connection failed or times out", a: "Ensure you\u2019re logging into the correct Square account with admin permissions. Try clearing your browser cache and disabling popup blockers, then attempt the connection again." },
              { q: "Token expiry warning", a: "Square tokens expire after 30 days. BloomSuite automatically refreshes tokens, but if you see an expiry warning, click \u201cReconnect\u201d to re-authorize the connection." },
              { q: "Customers not syncing", a: "Only customers with an email address are synced. Ensure your Square customers have email addresses associated with their profiles. Anonymous transactions won\u2019t create customer records." },
              { q: "Automations not triggering", a: "Check that your automation is active (toggle ON). For real-time triggers like purchases, ensure the webhook connection is working \u2014 you can test by making a small purchase." },
              { q: "Sandbox vs Production environment", a: "BloomSuite automatically detects your environment. Development environments use Square Sandbox, while production uses live Square credentials. You can see the current environment on the connection card." },
            ].map(({ q, a }) => (
              <Accordion key={q} sx={{ "& .MuiAccordionSummary-root": { px: 0 } }}>
                <AccordionSummary><Typography level="body-sm" fontWeight="md">{q}</Typography></AccordionSummary>
                <AccordionDetails><Typography level="body-sm" textColor="text.secondary">{a}</Typography></AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </Sheet>

        {/* Pro Tips */}
        <Sheet variant="soft" color="neutral" sx={{ borderRadius: "lg", p: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
            <TrendingUp style={{ width: 16, height: 16 }} />
            <Typography level="title-sm" fontWeight="xl">Pro Tips</Typography>
          </Stack>
          <Stack spacing={0.75}>
            {[
              ["Tag your products", "in Square to enable plant care reminders and targeted campaigns"],
              ["Collect customer birthdays", "at checkout to enable birthday automation"],
              ["Use customer groups", "in Square \u2014 they\u2019ll sync as tags for segmentation"],
              ["Set up a welcome automation", "for first-time buyers to boost repeat purchases"],
              ["Enable review requests", "5 days after purchase to boost your online reputation"],
              ["Monitor the Analytics dashboard", "to see campaign performance and ROI"],
            ].map(([bold, rest]) => (
              <Typography key={bold} level="body-sm" textColor="text.secondary">
                \u2022 <strong>{bold}</strong> {rest}
              </Typography>
            ))}
          </Stack>
        </Sheet>

        {/* CTA */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="center" pt={1}>
          <Button variant="outlined" color="neutral" onClick={() => navigate("/integrations")}>Return to Integrations</Button>
          <Button variant="solid" color="neutral" onClick={() => navigate("/crm/automations/new")}>Set Up Your First Automation</Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default SquareGuidePage;
