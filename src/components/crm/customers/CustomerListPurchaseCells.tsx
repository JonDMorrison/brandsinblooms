import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { format } from "date-fns";
import { Calendar, DollarSign } from "lucide-react";
import {
  formatReportedCurrency,
  formatReportedPeriod,
  readReportedPeriodSpending,
} from "@/lib/crm/reportedPeriodSpending";

interface PurchaseCellCustomer {
  total_spent?: number | string | null;
  last_purchase_date?: string | null;
  custom_fields?: unknown;
}

const amountSx = {
  fontFamily: "var(--joy-fontFamily-display)",
  fontSize: "14px",
  fontWeight: 500,
  color: "neutral.900",
} as const;
const captionSx = { fontSize: "11px", color: "neutral.500", whiteSpace: "nowrap" } as const;
const mutedSx = { fontSize: "13px", color: "neutral.500" } as const;

function recordedSpend(value: PurchaseCellCustomer["total_spent"]): number | null {
  const amount = typeof value === "string" ? Number(value) : value;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : null;
}

/**
 * Recorded spending comes from dated receipts. When there is none but a POS
 * spending report exists, show the report total with its period instead of $0.
 */
export function CustomerListSpendCell({ customer }: { customer: PurchaseCellCustomer }) {
  const recorded = recordedSpend(customer.total_spent);
  const reported = readReportedPeriodSpending(customer.custom_fields);

  if ((recorded === null || recorded === 0) && reported) {
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

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
      <DollarSign size={12} strokeWidth={1.9} color="var(--joy-palette-neutral-400)" />
      <Typography sx={amountSx}>{recorded ? recorded.toFixed(2) : "0.00"}</Typography>
    </Stack>
  );
}

/** A missing purchase date means no dated receipt is on file. It never proves the customer bought nothing. */
export function CustomerListLastPurchaseCell({ customer }: { customer: PurchaseCellCustomer }) {
  if (customer.last_purchase_date) {
    return (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Calendar size={12} strokeWidth={1.9} color="var(--joy-palette-neutral-400)" />
        <Typography sx={mutedSx}>
          {format(new Date(customer.last_purchase_date), "MMM d, yyyy")}
        </Typography>
      </Stack>
    );
  }

  const reported = readReportedPeriodSpending(customer.custom_fields);
  if (reported) {
    return (
      <Stack spacing={0.25}>
        <Typography sx={mutedSx}>No dated receipts</Typography>
        <Typography sx={captionSx}>
          {reported.transactions} reported transactions
        </Typography>
      </Stack>
    );
  }

  return <Typography sx={mutedSx}>No recorded purchases</Typography>;
}
