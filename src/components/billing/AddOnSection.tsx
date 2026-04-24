import { useState } from "react";
import Alert from "@mui/joy/Alert";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";

const surfaceStyles = {
  borderRadius: "24px",
  borderColor: "divider",
  bgcolor: "background.surface",
  boxShadow: "sm",
  p: { xs: 2.5, sm: 3 },
};

const getPercent = (used: number, total: number) => {
  if (total <= 0) {
    return 0;
  }

  return Math.min((used / total) * 100, 100);
};

export const AddOnSection = () => {
  const { subscription, loading } = useSubscription();
  const [processingCRM, setProcessingCRM] = useState(false);
  const [processingSMS, setProcessingSMS] = useState(false);

  const handleToggleAddOn = async (
    addOnType: "crm" | "sms",
    enabled: boolean,
  ) => {
    if (enabled) {
      const setLoading =
        addOnType === "crm" ? setProcessingCRM : setProcessingSMS;
      setLoading(true);

      try {
        const priceId =
          addOnType === "crm" ? "crm_addon_monthly" : "sms_addon_monthly";
        const { data, error } = await supabase.functions.invoke(
          "create-checkout",
          {
            body: {
              plan: priceId,
              billing_interval: "monthly",
            },
          },
        );

        if (error) throw error;

        if (data?.url) {
          window.open(data.url, "_blank", "noopener,noreferrer");
        } else {
          throw new Error("No checkout URL received");
        }
      } catch (error) {
        console.error(`Error enabling ${addOnType} add-on:`, error);
        toast.error(`Failed to enable ${addOnType} add-on. Please try again.`);
      } finally {
        setLoading(false);
      }
    } else {
      const setLoading =
        addOnType === "crm" ? setProcessingCRM : setProcessingSMS;
      setLoading(true);
      try {
        const { data, error } =
          await supabase.functions.invoke("customer-portal");

        if (error) throw error;

        if (data?.url) {
          window.open(data.url, "_blank", "noopener,noreferrer");
        } else {
          throw new Error("No portal URL received");
        }
      } catch (error) {
        console.error("Error accessing customer portal:", error);
        toast.error("Failed to access billing portal. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <Sheet variant="outlined" sx={surfaceStyles}>
        <Stack spacing={2.5}>
          <Stack spacing={0.75}>
            <Skeleton variant="text" width={110} />
            <Skeleton variant="text" width="40%" />
          </Stack>
          <Divider />
          <Skeleton variant="rectangular" height={64} />
          <Skeleton variant="rectangular" height={64} />
        </Stack>
      </Sheet>
    );
  }

  const crmEnabled = subscription?.crm_enabled || false;
  const smsEnabled = subscription?.sms_enabled || false;

  const emailUsage = subscription?.email_usage || 0;
  const emailQuota = subscription?.email_quota || 1000;
  const emailUsagePercent = getPercent(emailUsage, emailQuota);

  const smsUsage = subscription?.sms_usage || 0;
  const smsQuota = subscription?.sms_quota || 250;
  const smsUsagePercent = getPercent(smsUsage, smsQuota);

  return (
    <Sheet variant="outlined" sx={surfaceStyles}>
      <Stack spacing={2.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography level="title-md">Add-Ons</Typography>
          <Chip color="neutral" size="sm" variant="soft">
            Optional
          </Chip>
        </Stack>
        <Typography level="body-sm" textColor="text.secondary">
          Add CRM email tools or SMS campaigns without changing your base
          subscription.
        </Typography>

        <Divider />

        <Sheet variant="soft" sx={{ borderRadius: "18px", p: 2.25 }}>
          <Stack spacing={2}>
            <Stack
              direction="row"
              spacing={2}
              justifyContent="space-between"
              alignItems="flex-start"
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Mail size={18} color="var(--joy-palette-neutral-500)" />
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography level="title-sm">
                      CRM + Email Marketing
                    </Typography>
                    <Typography level="body-xs" textColor="text.secondary">
                      $29/month
                    </Typography>
                  </Stack>
                  <Typography level="body-sm" textColor="text.secondary">
                    Customer management, campaign sending, and email performance
                    reporting.
                  </Typography>
                </Stack>
              </Stack>
              <Switch
                checked={crmEnabled}
                color="neutral"
                disabled={processingCRM}
                onChange={(event) =>
                  handleToggleAddOn("crm", event.target.checked)
                }
              />
            </Stack>

            {crmEnabled ? (
              <Stack spacing={1.25}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Typography level="body-sm">
                    Email usage this month
                  </Typography>
                  <Typography level="body-sm" fontWeight={600}>
                    {emailUsage} / {emailQuota}
                  </Typography>
                </Stack>
                <LinearProgress
                  color={emailUsagePercent > 80 ? "warning" : "neutral"}
                  determinate
                  size="sm"
                  value={emailUsagePercent}
                  variant="soft"
                />
                {emailUsagePercent > 80 ? (
                  <Alert
                    color="warning"
                    size="sm"
                    startDecorator={<AlertTriangle size={16} />}
                    variant="soft"
                  >
                    You&apos;re nearing your email limit.
                  </Alert>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </Sheet>

        <Sheet variant="soft" sx={{ borderRadius: "18px", p: 2.25 }}>
          <Stack spacing={2}>
            <Stack
              direction="row"
              spacing={2}
              justifyContent="space-between"
              alignItems="flex-start"
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <MessageSquare
                  size={18}
                  color="var(--joy-palette-neutral-500)"
                />
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography level="title-sm">SMS Marketing</Typography>
                    <Typography level="body-xs" textColor="text.secondary">
                      $19/month
                    </Typography>
                  </Stack>
                  <Typography level="body-sm" textColor="text.secondary">
                    Text campaigns and customer notifications sent through your
                    billing account.
                  </Typography>
                </Stack>
              </Stack>
              <Switch
                checked={smsEnabled}
                color="neutral"
                disabled={processingSMS}
                onChange={(event) =>
                  handleToggleAddOn("sms", event.target.checked)
                }
              />
            </Stack>

            {smsEnabled ? (
              <Stack spacing={1.25}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Typography level="body-sm">SMS usage this month</Typography>
                  <Typography level="body-sm" fontWeight={600}>
                    {smsUsage} / {smsQuota}
                  </Typography>
                </Stack>
                <LinearProgress
                  color={smsUsagePercent > 80 ? "warning" : "neutral"}
                  determinate
                  size="sm"
                  value={smsUsagePercent}
                  variant="soft"
                />
                {smsUsagePercent > 80 ? (
                  <Alert
                    color="warning"
                    size="sm"
                    startDecorator={<AlertTriangle size={16} />}
                    variant="soft"
                  >
                    You&apos;re nearing your SMS limit.
                  </Alert>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </Sheet>
      </Stack>
    </Sheet>
  );
};
