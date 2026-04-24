import React from "react";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { CreditCard } from "lucide-react";
import { DeleteAccountSection } from "@/components/account/DeleteAccountSection";
import { AddOnSection } from "@/components/billing/AddOnSection";
import { BillingHistory } from "@/components/billing/BillingHistory";
import { PaymentMethods } from "@/components/billing/PaymentMethods";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { UsageAnalytics } from "@/components/billing/UsageAnalytics";
import { useSubscription as useBillingSubscription } from "@/hooks/useSubscription";

export const AccountBillingSettings = () => {
  const { loading } = useBillingSubscription();

  return (
    <Stack spacing={3}>
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <CreditCard size={18} />
          <Typography level="title-lg">Account & Billing</Typography>
        </Stack>
        <Typography level="body-sm" sx={{ color: "text.secondary", maxWidth: 760 }}>
          Review plan details, billing history, usage limits, optional add-ons,
          and account-level actions from one place.
        </Typography>
      </Stack>

      {loading ? (
        <Stack spacing={2}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              animation="wave"
              variant="rectangular"
              sx={{ height: 152, borderRadius: "24px" }}
            />
          ))}
        </Stack>
      ) : (
        <>
          <SubscriptionCard />
          <PaymentMethods />
          <BillingHistory />
          <AddOnSection />
          <UsageAnalytics />
          <DeleteAccountSection />
        </>
      )}
    </Stack>
  );
};
