import React from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, BarChart3, CreditCard } from "lucide-react";
import { DeleteAccountSection } from "@/components/account/DeleteAccountSection";
import { BillingDashboard } from "@/components/billing/BillingDashboard";
import { UsageAnalytics } from "@/components/billing/UsageAnalytics";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import {
  JoyTabs,
  JoyTabsContent,
  JoyTabsList,
  JoyTabsTrigger,
} from "@/components/joy/JoyTabs";

export const AccountBillingSettings = () => {
  return (
    <JoyCard>
      <JoyCardHeader
        title="Account & Billing"
        description="Review subscription details, monitor usage, and manage account-level actions."
        startDecorator={
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "16px",
              display: "grid",
              placeItems: "center",
              backgroundColor: "primary.50",
              color: "primary.700",
            }}
          >
            <CreditCard className="h-5 w-5" />
          </Box>
        }
      />
      <JoyCardContent>
        <JoyTabs defaultValue="billing">
          <JoyTabsList
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                md: "repeat(3, minmax(0, 1fr))",
              },
            }}
          >
            <JoyTabsTrigger value="billing">
              <Stack direction="row" spacing={1} alignItems="center">
                <CreditCard className="h-4 w-4" />
                <span>Billing & Subscription</span>
              </Stack>
            </JoyTabsTrigger>
            <JoyTabsTrigger value="usage">
              <Stack direction="row" spacing={1} alignItems="center">
                <BarChart3 className="h-4 w-4" />
                <span>Usage Analytics</span>
              </Stack>
            </JoyTabsTrigger>
            <JoyTabsTrigger value="danger">
              <Stack direction="row" spacing={1} alignItems="center">
                <AlertTriangle className="h-4 w-4" />
                <span>Account Management</span>
              </Stack>
            </JoyTabsTrigger>
          </JoyTabsList>

          <JoyTabsContent value="billing">
            <BillingDashboard />
          </JoyTabsContent>

          <JoyTabsContent value="usage">
            <UsageAnalytics />
          </JoyTabsContent>

          <JoyTabsContent value="danger">
            <JoyCard
              variant="plain"
              sx={{
                borderColor: "danger.200",
                backgroundColor:
                  "rgba(var(--joy-palette-danger-mainChannel) / 0.04)",
              }}
            >
              <JoyCardHeader
                title="Danger Zone"
                description="Irreversible actions that permanently affect this tenant account."
                titleProps={{ color: "danger" }}
                startDecorator={
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                }
              />
              <JoyCardContent>
                <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
                  Only proceed if you intend to permanently remove access and
                  associated account data.
                </Typography>
                <DeleteAccountSection />
              </JoyCardContent>
            </JoyCard>
          </JoyTabsContent>
        </JoyTabs>
      </JoyCardContent>
    </JoyCard>
  );
};
