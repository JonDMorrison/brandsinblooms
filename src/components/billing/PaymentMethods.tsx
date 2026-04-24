import { useState } from "react";
import Button from "@mui/joy/Button";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { CheckCircle2, CreditCard, Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { CustomerPortalButton } from "@/components/subscription/CustomerPortalButton";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";

const surfaceStyles = {
  borderRadius: "24px",
  borderColor: "divider",
  bgcolor: "background.surface",
  boxShadow: "sm",
  p: { xs: 2.5, sm: 3 },
};

export const PaymentMethods = () => {
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const [loading, setLoading] = useState(false);

  const effectivePlan = subscription?.tier ?? subscription?.plan;
  const isTrialOrExpired = !subscription || effectivePlan === "free_trial" || effectivePlan === "expired";

  const handleAddPaymentMethod = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");

      if (error) {
        throw error;
      }

      if (data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        throw new Error("No portal URL received");
      }
    } catch (error) {
      console.error("Error accessing payment methods:", error);
      toast.error("Failed to access payment methods. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet variant="outlined" sx={surfaceStyles}>
      <Stack spacing={2.5}>
        <Stack spacing={0.75}>
          <Typography level="title-md">Payment Method</Typography>
          <Typography level="body-sm" textColor="text.secondary">
            Manage the card used for subscription renewals and add-ons.
          </Typography>
        </Stack>

        <Divider />

        {subscriptionLoading ? (
          <Stack spacing={1.5}>
            <Skeleton variant="text" width={140} />
            <Skeleton variant="rectangular" height={56} />
            <Skeleton variant="text" width={160} />
          </Stack>
        ) : isTrialOrExpired ? (
          <Stack spacing={2} alignItems="center" textAlign="center" sx={{ py: 3 }}>
            <CreditCard size={32} color="var(--joy-palette-neutral-400)" />
            <Stack spacing={0.75}>
              <Typography level="title-sm">No payment method on file.</Typography>
              <Typography level="body-sm" textColor="text.secondary">
                Add a card now so renewals and account reactivation can complete without interruption.
              </Typography>
            </Stack>
            <Button
              color="neutral"
              loading={loading}
              onClick={handleAddPaymentMethod}
              size="sm"
              startDecorator={<Plus size={16} />}
              variant="outlined"
            >
              Add Payment Method
            </Button>
          </Stack>
        ) : (
          <Sheet
            variant="soft"
            sx={{
              borderRadius: "18px",
              p: 2,
            }}
          >
            <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Sheet
                  color="neutral"
                  variant="solid"
                  sx={{
                    borderRadius: "12px",
                    px: 1.25,
                    py: 0.75,
                  }}
                >
                  <Typography level="body-xs" fontWeight={700} textColor="common.white">
                    VISA
                  </Typography>
                </Sheet>
                <Stack spacing={0.5}>
                  <Typography level="body-md" fontWeight={600}>
                    Visa ending in 4242
                  </Typography>
                  <Typography level="body-sm" textColor="text.secondary">
                    Expires 12/25
                  </Typography>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1.25} alignItems="center">
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <CheckCircle2 size={16} color="var(--joy-palette-success-500)" />
                  <Typography level="body-sm" textColor="text.secondary">
                    Default
                  </Typography>
                </Stack>
                <CustomerPortalButton size="sm" variant="ghost" />
              </Stack>
            </Stack>
          </Sheet>
        )}

        <Divider />

        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Lock size={16} color="var(--joy-palette-neutral-500)" />
          <Typography level="body-xs" textColor="text.secondary">
            Payments are securely processed by Stripe. BloomSuite does not store your full card details.
          </Typography>
        </Stack>
      </Stack>
    </Sheet>
  );
};