import { CheckCircle, Copy, CreditCard, Package, RefreshCw, ShoppingCart, Store, UserCircle, Users, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Box, Button, Chip, Sheet, Stack, Typography } from "@mui/joy";
import { toast } from "sonner";

import { RawDataPre } from "@/components/integrations/shared/dataTabPrimitives";

interface EndpointResult {
  success: boolean;
  count?: number;
  samples?: unknown[];
  data?: Record<string, unknown>;
  error?: string;
  timing_ms: number;
  status_code?: number;
}

interface TestReport {
  status: "success" | "partial" | "failed";
  summary: string;
  duration_ms: number;
  results: {
    merchant: EndpointResult;
    employees: EndpointResult;
    customers: EndpointResult;
    inventory: EndpointResult;
    orders: EndpointResult;
    payments: EndpointResult;
  };
  counts: {
    employees: number;
    customers: number;
    items: number;
    orders_last_30d: number;
    payments_last_30d: number;
  };
  errors: Array<{ endpoint: string; code: string; message: string }>;
}

interface CloverTestReportProps {
  report: TestReport;
  testedAt?: string;
  onRerun: () => void;
  isRunning?: boolean;
}

function StatusChip({ status }: { status: TestReport["status"] }) {
  if (status === "success") {
    return (
      <Chip size="sm" color="success" variant="soft" startDecorator={<CheckCircle size={14} />}>
        All tests passed
      </Chip>
    );
  }

  if (status === "partial") {
    return (
      <Chip size="sm" color="warning" variant="soft">
        Partial success
      </Chip>
    );
  }

  return (
    <Chip size="sm" color="danger" variant="soft" startDecorator={<XCircle size={14} />}>
      Tests failed
    </Chip>
  );
}

function EndpointCard({
  name,
  Icon,
  result,
  count,
}: {
  name: string;
  Icon: typeof Store;
  result: EndpointResult;
  count?: number;
}) {
  const hasSamples = Array.isArray(result.samples) && result.samples.length > 0;
  const hasData = result.data && Object.keys(result.data).length > 0;

  return (
    <Sheet variant="outlined" sx={{ p: 1.25, borderRadius: "md", bgcolor: "background.level1" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Icon size={14} />
          <Typography level="title-sm">{name}</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {result.success && typeof count === "number" ? (
            <Chip size="sm" variant="soft" color="neutral">
              {count}
            </Chip>
          ) : null}
          <Chip size="sm" color={result.success ? "success" : "danger"} variant="soft">
            {result.success ? "OK" : "Fail"}
          </Chip>
        </Stack>
      </Stack>
      <Typography level="body-xs" sx={{ color: "text.tertiary", mt: 0.5 }}>
        {result.timing_ms}ms
      </Typography>
      {!result.success && result.error ? (
        <Typography level="body-xs" color="danger" sx={{ mt: 0.5 }}>
          {result.error}
        </Typography>
      ) : null}
      {hasData || hasSamples ? (
        <details style={{ marginTop: "0.5rem" }}>
          <summary style={{ cursor: "pointer", fontSize: "0.75rem" }}>Inspect payload</summary>
          {hasData ? <RawDataPre value={result.data} /> : null}
          {hasSamples ? <RawDataPre value={result.samples} /> : null}
        </details>
      ) : null}
    </Sheet>
  );
}

export const CloverTestReport = ({ report, testedAt, onRerun, isRunning }: CloverTestReportProps) => {
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      toast.success("Test report JSON copied.");
    } catch {
      toast.error("Unable to copy test report JSON.");
    }
  };

  return (
    <Sheet variant="outlined" sx={{ p: 2, borderRadius: "lg", bgcolor: "background.surface" }}>
      <Stack spacing={1.25}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            <Typography level="title-md">Connection test results</Typography>
            <StatusChip status={report.status} />
          </Stack>
          <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
            {testedAt ? formatDistanceToNow(new Date(testedAt), { addSuffix: true }) : "Just now"} - {report.duration_ms}ms
          </Typography>
        </Stack>

        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          {report.summary}
        </Typography>

        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
          }}
        >
          <EndpointCard name="Merchant" Icon={Store} result={report.results.merchant} />
          <EndpointCard name="Employees" Icon={UserCircle} result={report.results.employees} count={report.counts.employees} />
          <EndpointCard name="Customers" Icon={Users} result={report.results.customers} count={report.counts.customers} />
          <EndpointCard name="Inventory" Icon={Package} result={report.results.inventory} count={report.counts.items} />
          <EndpointCard name="Orders (30d)" Icon={ShoppingCart} result={report.results.orders} count={report.counts.orders_last_30d} />
          <EndpointCard name="Payments (30d)" Icon={CreditCard} result={report.results.payments} count={report.counts.payments_last_30d} />
        </Box>

        {report.errors.length > 0 ? (
          <Sheet variant="soft" color="danger" sx={{ p: 1.25, borderRadius: "md" }}>
            <Typography level="title-sm">Errors ({report.errors.length})</Typography>
            <Stack spacing={0.5} sx={{ mt: 0.75 }}>
              {report.errors.map((error, index) => (
                <Typography key={`${error.endpoint}-${index}`} level="body-xs" color="danger">
                  {error.endpoint}: [{error.code}] {error.message}
                </Typography>
              ))}
            </Stack>
          </Sheet>
        ) : null}

        <Stack direction="row" spacing={1}>
          <Button size="sm" variant="outlined" onClick={onRerun} disabled={isRunning} startDecorator={<RefreshCw size={14} />}>
            {isRunning ? "Running..." : "Re-run test"}
          </Button>
          <Button size="sm" variant="plain" color="neutral" onClick={copyToClipboard} startDecorator={<Copy size={14} />}>
            Copy JSON
          </Button>
        </Stack>
      </Stack>
    </Sheet>
  );
};
