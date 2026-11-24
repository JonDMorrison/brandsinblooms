import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { format } from "date-fns";
import { Calendar, DollarSign } from "lucide-react";
import {
  formatReportedCurrency,
  formatReportedPeriod,
} from "@/lib/crm/reportedPeriodSpending";
import {
  formatCustomerCurrency,
  resolveCustomerPurchaseSummary,
  type CustomerPurchaseSource,
} from "@/lib/crm/customerPurchaseSummary";

type PurchaseCellCustomer = CustomerPurchaseSource;

const amountSx = {
  fontFamily: "var(--joy-fontFamily-display)",
  fontSize: "14px",
  fontWeight: 500,
  color: "neutral.900",
} as const;
const captionSx = { fontSize: "11px", color: "neutral.500", whiteSpace: "nowrap" } as const;
const mutedSx = { fontSize: "13px", color: "neutral.500" } as const;

/**
 * Lifetime value from the shared customer purchase summary (the same number
 * the customer record, Purchases tab and Bloom show). When none is recorded
 * but a POS spending report exists, show the report total with its period.
 */
export function CustomerListSpendCell({
  customer,
  currency = "USD",
}: {
  customer: PurchaseCellCustomer;
  /** Tenant currency (resolveTenantCurrency), e.g. "USD" -> $3,700.91. */
  currency?: string;
}) {
  const summary = resolveCustomerPurchaseSummary(customer);
  const recorded = summary.lifetimeValue;
  const reported = summary.reportedPeriod;

  if (reported) {
    return (
      <Stack alignItems="flex-end" spacing={0.25}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <DollarSign size={12} strokeWidth={1.9} color="var(--joy-palette-neutral-400)" />
          <Typography sx={amountSx}>{formatReportedCurrency(reported.spend)}</Typography>
        </Stack>
        <Typography sx={captionSx}>Reported {formatReportedPeriod(reported)}</Typography>
      </Stack>
    );
  }

  if (recorded === null) {
    return <Typography sx={{ ...mutedSx, textAlign: "right" }}>Unknown</Typography>;
  }

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
      <Typography sx={amountSx}>{formatCustomerCurrency(recorded, currency, "en-US")}</Typography>
    </Stack>
  );
}

/** A missing purchase date means no dated receipt is on file. It never proves the customer bought nothing. */
export function CustomerListLastPurchaseCell({ customer }: { customer: PurchaseCellCustomer }) {
  const summary = resolveCustomerPurchaseSummary(customer);
  if (summary.lastPurchaseDate) {
    return (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Calendar size={12} strokeWidth={1.9} color="var(--joy-palette-neutral-400)" />
        <Typography sx={mutedSx}>
          {format(new Date(summary.lastPurchaseDate), "MMM d, yyyy")}
        </Typography>
      </Stack>
    );
  }

  const reported = summary.reportedPeriod;
  if (reported) {
    return (
      <Stack spacing={0.25}>
        <Typography sx={mutedSx}>No dated receipts</Typography>
        <Typography sx={captionSx}>
          {reported.transactions} reported{" "}
          {reported.transactions === 1 ? "transaction" : "transactions"}
        </Typography>
      </Stack>
    );
  }

  return <Typography sx={mutedSx}>No recorded purchases</Typography>;
}
