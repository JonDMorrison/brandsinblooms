import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Calendar, Download, ExternalLink, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";

type InvoiceSummary = {
  id: string;
  created: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  url: string | null;
};

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format(amount);

const surfaceStyles = {
  borderRadius: "24px",
  borderColor: "divider",
  bgcolor: "background.surface",
  boxShadow: "sm",
  p: { xs: 2.5, sm: 3 },
};

const formatDate = (value: string) => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

export const BillingHistory = () => {
  const { subscription, loading } = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);

  const effectivePlan = subscription?.tier ?? subscription?.plan;
  const isTrialOrExpired =
    !subscription ||
    effectivePlan === "free_trial" ||
    effectivePlan === "expired";
  // Real Stripe invoices only. This list used to show three hard-coded
  // "Sprout Plan" invoices from 2023 to every paying account.
  const invoicesQuery = useQuery({
    queryKey: ["billing-invoices", subscription?.id ?? null],
    enabled: !loading && !isTrialOrExpired,
    staleTime: 60_000,
    queryFn: async (): Promise<InvoiceSummary[]> => {
      const { data, error } = await supabase.functions.invoke("billing-invoices");
      if (error) throw error;
      return Array.isArray(data?.invoices) ? (data.invoices as InvoiceSummary[]) : [];
    },
  });
  const invoices = invoicesQuery.data ?? [];

  const handleViewAll = async () => {
    setPortalLoading(true);
    try {
      const { data, error } =
        await supabase.functions.invoke("customer-portal");

      if (error) {
        throw error;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL received");
      }
    } catch (error) {
      console.error("Error accessing customer portal:", error);
      toast.error("Failed to open billing history. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <Sheet variant="outlined" sx={surfaceStyles}>
      <Stack spacing={2.5}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={2}
        >
          <Stack spacing={0.75}>
            <Typography level="title-md">Billing History</Typography>
            <Typography level="body-sm" textColor="text.secondary">
              Review recent invoices and jump into the Stripe portal for the
              full ledger.
            </Typography>
          </Stack>
          {!isTrialOrExpired && !loading ? (
            <Button
              color="neutral"
              endDecorator={<ExternalLink size={14} />}
              loading={portalLoading}
              onClick={handleViewAll}
              size="sm"
              variant="plain"
            >
              View All
            </Button>
          ) : null}
        </Stack>

        <Divider />

        {loading || invoicesQuery.isLoading ? (
          <Stack spacing={1.25}>
            <Skeleton variant="text" width={160} />
            <Skeleton variant="rectangular" height={48} />
            <Skeleton variant="rectangular" height={48} />
            <Skeleton variant="rectangular" height={48} />
          </Stack>
        ) : isTrialOrExpired || invoicesQuery.isError || invoices.length === 0 ? (
          <Stack
            spacing={1.5}
            alignItems="center"
            textAlign="center"
            sx={{ py: 3 }}
          >
            <Receipt size={32} color="var(--joy-palette-neutral-400)" />
            <Typography level="title-sm">
              {invoicesQuery.isError ? "Billing history couldn't load." : "No billing history yet."}
            </Typography>
            <Typography level="body-sm" textColor="text.secondary">
              {invoicesQuery.isError
                ? "Use View All to open your invoices in Stripe."
                : isTrialOrExpired
                  ? "Invoices will appear here once you move to a paid subscription."
                  : "Your first invoice will appear here after it is issued."}
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1.25}>
            {invoices.map((invoice) => {
              const downloadDisabled = !invoice.url;

              return (
                <Sheet
                  key={invoice.id}
                  variant="soft"
                  sx={{
                    borderRadius: "18px",
                    p: 1.75,
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                      <Typography level="body-md" fontWeight={600}>
                        {invoice.description}
                      </Typography>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Calendar
                          size={14}
                          color="var(--joy-palette-neutral-500)"
                        />
                        <Typography level="body-xs" textColor="text.secondary">
                          {formatDate(invoice.created)}
                        </Typography>
                      </Stack>
                    </Stack>

                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Chip color={invoice.status === "paid" ? "success" : "warning"} size="sm" variant="soft">
                        {invoice.status.charAt(0).toUpperCase() +
                          invoice.status.slice(1)}
                      </Chip>
                      <Typography level="body-md" fontWeight={700}>
                        {formatAmount(invoice.amount, invoice.currency)}
                      </Typography>
                      <IconButton
                        color="neutral"
                        disabled={downloadDisabled}
                        onClick={() => {
                          if (!downloadDisabled) {
                            window.open(
                              invoice.url ?? undefined,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }
                        }}
                        size="sm"
                        variant="plain"
                      >
                        <Download size={16} />
                      </IconButton>
                    </Stack>
                  </Stack>
                </Sheet>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Sheet>
  );
};
