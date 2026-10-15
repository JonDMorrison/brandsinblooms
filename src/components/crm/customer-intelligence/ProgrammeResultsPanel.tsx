import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalClose,
  ModalDialog,
  Option,
  Select,
  Sheet,
  Stack,
  Table,
  Typography,
} from "@mui/joy";
import { Download, Search, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  downloadProgrammeData,
  programmeCommand,
  programmeResultCsv,
  type ProgrammeResultPage,
} from "@/lib/loyalty/programmeApi";
import type {
  CustomerComparison,
  CustomerPeriod,
} from "../../../../supabase/functions/_shared/loyalty/programme-measurement";

const states = [
  "growing",
  "stable",
  "declining",
  "lapsed",
  "reactivated",
  "newly_observed",
  "no_baseline",
  "unknown",
  "identity_review",
];
const label = (value: string) => value.replaceAll("_", " ");
export function ProgrammeResultsPanel({
  tenantId,
  initial,
}: {
  tenantId: string;
  initial: ProgrammeResultPage;
}) {
  const navigate = useNavigate();
  const [view, setView] = React.useState(initial),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState("");
  const [state, setState] = React.useState("declining"),
    [name, setName] = React.useState("Declining programme customers"),
    [confirmed, setConfirmed] = React.useState(false);
  const [selection, setSelection] = React.useState<CustomerComparison[] | null>(
    null,
  );
  const [evidence, setEvidence] = React.useState<{
    comparison: CustomerComparison;
    baseline: CustomerPeriod;
    current: CustomerPeriod;
  } | null>(null);
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const r = view.result,
    s = r.summary,
    money = (v: number) =>
      new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: r.settings.currency,
      }).format(v / 100);
  const percent = (v: number | null) =>
    v === null ? "Not scored" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
  async function run(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "Unable to load the saved result.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function allRows(): Promise<CustomerComparison[]> {
    const first = await programmeCommand<ProgrammeResultPage>(tenantId, {
      action: "get_run",
      runId: initial.runId,
      page: 1,
    });
    const rows = [...first.result.rows];
    let n = 1;
    while (rows.length < first.result.count) {
      if (!mounted.current) throw new Error("Workspace changed.");
      const next = await programmeCommand<ProgrammeResultPage>(tenantId, {
        action: "get_run",
        runId: initial.runId,
        page: ++n,
      });
      if (next.result.count !== first.result.count || !next.result.rows.length)
        throw new Error(
          "The saved report could not be completely read. No partial export was produced.",
        );
      rows.push(...next.result.rows);
    }
    if (new Set(rows.map((row) => row.customerId)).size !== first.result.count)
      throw new Error("Duplicate report members require reconciliation.");
    return rows;
  }
  async function loadPage(n: number) {
    await run(async () => {
      const result = await programmeCommand<ProgrammeResultPage>(tenantId, {
        action: "get_run",
        runId: initial.runId,
        page: n,
      });
      if (mounted.current) setView(result);
    });
  }
  async function previewSegment() {
    await run(async () => {
      const rows = await allRows();
      if (mounted.current) {
        setSelection(rows.filter((row) => row.state === state));
        setConfirmed(false);
      }
    });
  }
  async function saveSegment() {
    if (!selection?.length || !confirmed) return;
    await run(async () => {
      const result = await programmeCommand<{ saved: { segmentId: string } }>(
        tenantId,
        {
          action: "save_result_segment",
          runId: initial.runId,
          states: [state],
          name,
          expectedCount: selection.length,
          confirmed: true,
        },
      );
      if (mounted.current)
        navigate(
          `/crm/segments?segment=${encodeURIComponent(result.saved.segmentId)}`,
        );
    });
  }
  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        gap={1}
        justifyContent="space-between"
        alignItems={{ sm: "center" }}
      >
        <Stack spacing={0.5}>
          <Typography level="h3">What changed for these customers?</Typography>
          <Typography level="body-sm">
            {r.baselineWindow.start}–{r.baselineWindow.end} compared with{" "}
            {r.currentWindow.start}–{r.currentWindow.end}.{" "}
            {r.normalizeDaily ? "Daily rates." : "Equal-period totals."}
          </Typography>
        </Stack>
        <Button
          variant="outlined"
          startDecorator={<Download size={16} />}
          loading={busy}
          onClick={() =>
            void run(async () => {
              const rows = await allRows();
              if (mounted.current)
                downloadProgrammeData(
                  `programme-${initial.runId}.csv`,
                  programmeResultCsv(rows, r.settings.currency),
                  "text/csv;charset=utf-8",
                );
            })
          }
        >
          Export all {s.originalCohort} customers
        </Button>
      </Stack>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4,1fr)" },
          gap: 1.5,
        }}
      >
        {[
          ["Customer growth", percent(s.meanCustomerGrowthPercent)],
          [
            "Retained customers",
            s.retentionPercent === null
              ? "Not established"
              : `${s.retainedCustomers} / ${s.establishedCustomers}`,
          ],
          ["Recorded net spending", money(s.recordedCurrentSpendMinor)],
          ["Needs more evidence", String(s.unscoredCustomers)],
        ].map(([title, value]) => (
          <Sheet key={title} variant="soft" sx={{ p: 2, borderRadius: "lg" }}>
            <Typography level="body-sm">{title}</Typography>
            <Typography level="h3" sx={{ mt: 0.75 }}>
              {value}
            </Typography>
          </Sheet>
        ))}
      </Box>
      {(r.coverage.baseline.status !== "reviewed_complete" ||
        r.coverage.current.status !== "reviewed_complete" ||
        s.unknownCustomers > 0) && (
        <Alert color="warning">
          Some records are incomplete or not independently reconciled. Missing
          history is not proof of a lost customer. {s.unknownCustomers}{" "}
          customers remain explicitly unknown.
        </Alert>
      )}
      <Typography level="body-sm">
        Original cohort: {s.originalCohort}. Comparable: {s.comparableCustomers}
        . New recorded enrolments across the company:{" "}
        {s.recordedNewEnrollmentsAllCustomers}. Captured cohort email consent:{" "}
        {s.cohortEmailConsentAtBaseline} → {s.cohortEmailConsentNow}.
      </Typography>
      <Sheet variant="outlined" sx={{ overflowX: "auto", borderRadius: "lg" }}>
        <Table
          size="sm"
          stripe="odd"
          sx={{ minWidth: 850, "& th": { whiteSpace: "nowrap" } }}
          aria-label="Programme customer comparison"
        >
          <thead>
            <tr>
              <th style={{ width: 200 }}>Customer</th>
              <th>Before / now</th>
              <th>Transactions</th>
              <th>Growth</th>
              <th>Interpretation</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((row) => (
              <tr key={row.customerId}>
                <td>
                  <Button
                    variant="plain"
                    size="sm"
                    onClick={() => navigate(`/crm/customers/${row.customerId}`)}
                    sx={{ wordBreak: "break-all" }}
                  >
                    {row.displayName ?? row.customerId}
                  </Button>
                </td>
                <td>
                  {money(row.baselineSpendMinor)}
                  <br />
                  {money(row.currentSpendMinor)}
                </td>
                <td>
                  {row.baselineTransactions} → {row.currentTransactions}
                </td>
                <td>
                  {percent(row.growthChangePercent)}
                  <br />
                  <Typography level="body-xs">
                    Index {row.growthIndex ?? "—"}
                  </Typography>
                </td>
                <td>
                  <Chip size="sm" variant="soft">
                    {label(row.state)}
                  </Chip>
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="plain"
                    startDecorator={<Search size={14} />}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const found = await programmeCommand<{
                          comparison: CustomerComparison;
                          baseline: CustomerPeriod;
                          current: CustomerPeriod;
                        }>(tenantId, {
                          action: "evidence",
                          runId: initial.runId,
                          customerId: row.customerId,
                        });
                        if (mounted.current) setEvidence(found);
                      })
                    }
                  >
                    Why?
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Sheet>
      <Stack direction="row" gap={1} alignItems="center">
        <Button
          variant="outlined"
          disabled={busy || r.page <= 1}
          onClick={() => void loadPage(r.page - 1)}
        >
          Previous
        </Button>
        <Typography level="body-sm">
          Page {r.page} of {Math.max(1, Math.ceil(r.count / 50))}
        </Typography>
        <Button
          variant="outlined"
          disabled={busy || !r.hasMore}
          onClick={() => void loadPage(r.page + 1)}
        >
          Next
        </Button>
      </Stack>
      <Sheet variant="outlined" sx={{ p: 2.5, borderRadius: "lg" }}>
        <Stack spacing={1.5}>
          <Typography level="title-lg">
            Turn the result into an audience
          </Typography>
          <Typography level="body-sm">
            Review the exact members, then save a static segment. No messages
            are sent here. Email and SMS permissions are checked separately when
            you create a campaign.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
            <FormControl>
              <FormLabel>Result group</FormLabel>
              <Select
                value={state}
                onChange={(_, value) => {
                  if (value) {
                    setState(value);
                    setSelection(null);
                    setConfirmed(false);
                  }
                }}
              >
                {states.map((item) => (
                  <Option key={item} value={item}>
                    {label(item)}
                  </Option>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ flex: 1 }}>
              <FormLabel>Segment name</FormLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FormControl>
            <Button
              variant="outlined"
              disabled={busy}
              onClick={() => void previewSegment()}
            >
              Review audience
            </Button>
          </Stack>
          {selection && (
            <>
              <Typography level="title-sm">
                {selection.length} exact customer records match “{label(state)}
                ”.
              </Typography>
              <Typography level="body-sm">
                The complete saved report can be exported above. Customer
                changes since this report will require reconciliation before
                saving.
              </Typography>
              <Checkbox
                label={`I have reviewed this ${selection.length}-customer audience.`}
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <Button
                startDecorator={<Users size={16} />}
                loading={busy}
                disabled={!confirmed || !selection.length || !name.trim()}
                onClick={() => void saveSegment()}
              >
                Save static segment
              </Button>
            </>
          )}
        </Stack>
      </Sheet>
      <Sheet variant="soft" sx={{ p: 2, borderRadius: "lg" }}>
        <Stack spacing={0.75}>
          <Typography level="title-sm">
            Campaign outcomes—not a claim of cause
          </Typography>
          <Typography level="body-sm">
            {s.contactedCustomers} cohort customers have a recorded sent message
            for the chosen campaign. {s.customersPurchasingAfterMessage}{" "}
            purchased afterward, with {money(s.recordedPostMessageSpendMinor)}{" "}
            recorded net spending.
          </Typography>
          {r.limitations.map((note) => (
            <Typography key={note} level="body-xs">
              {note}
            </Typography>
          ))}
          <Typography level="body-xs">
            Baseline captured {new Date(r.baselineCutoff).toLocaleString()}.
            Comparison captured {new Date(r.sourceCutoff).toLocaleString()}.
          </Typography>
        </Stack>
      </Sheet>
      {error && (
        <Alert role="alert" color="danger">
          {error}
        </Alert>
      )}
      <Modal open={Boolean(evidence)} onClose={() => setEvidence(null)}>
        <ModalDialog
          layout="center"
          sx={{ width: "min(920px,95vw)", maxHeight: "90vh", overflow: "auto" }}
        >
          <ModalClose />
          <Typography level="h3">The records behind this result</Typography>
          {evidence && (
            <>
              <Typography>{evidence.comparison.reason}</Typography>
              <Typography level="body-sm">
                Customer {evidence.comparison.customerId}. Amounts below are
                exact integer minor units in {r.settings.currency}.
              </Typography>
              <Box
                component="pre"
                sx={{
                  fontSize: 13,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  bgcolor: "background.level1",
                  p: 2,
                  borderRadius: "md",
                }}
              >
                {JSON.stringify(evidence, null, 2)}
              </Box>
            </>
          )}
        </ModalDialog>
      </Modal>
    </Stack>
  );
}
