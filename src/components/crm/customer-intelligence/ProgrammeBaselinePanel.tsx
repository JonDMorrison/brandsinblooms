import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  Input,
  Option,
  Select,
  Sheet,
  Stack,
  Table,
  Textarea,
  Typography,
} from "@mui/joy";
import {
  programmeCommand,
  type ProgrammeDetail,
  type BaselinePreview,
  type BaselinePreviewPage,
  type ProgrammeResultPage,
} from "@/lib/loyalty/programmeApi";
import { ProgrammeResultsPanel } from "./ProgrammeResultsPanel";
import type { CustomerPeriod } from "../../../../supabase/functions/_shared/loyalty/programme-measurement";

interface AudienceChoices {
  segments: { id: string; name: string; auto_update: boolean }[];
  bloomSets: { id: string; label: string }[];
}
export function ProgrammeBaselinePanel({
  tenantId,
  detail,
  onSaved,
}: {
  tenantId: string;
  detail: ProgrammeDetail;
  onSaved: () => Promise<void>;
}) {
  const [choices, setChoices] = React.useState<AudienceChoices>({
    segments: [],
    bloomSets: [],
  });
  const [audience, setAudience] = React.useState("all_customers"),
    [start, setStart] = React.useState(`${new Date().getFullYear() - 1}-01-01`),
    [end, setEnd] = React.useState(`${new Date().getFullYear() - 1}-12-31`);
  const [spend, setSpend] = React.useState("50"),
    [transactions, setTransactions] = React.useState("50");
  const [reviewed, setReviewed] = React.useState(false),
    [evidence, setEvidence] = React.useState(""),
    [confirmed, setConfirmed] = React.useState(false);
  const [preview, setPreview] = React.useState<BaselinePreview | null>(null),
    [previewRows, setPreviewRows] = React.useState<CustomerPeriod[]>([]),
    [previewPage, setPreviewPage] = React.useState(1);
  const [baselineId, setBaselineId] = React.useState(
    detail.baselines[0]?.id ?? "",
  );
  const [currentStart, setCurrentStart] = React.useState(
      `${new Date().getFullYear()}-01-01`,
    ),
    [currentEnd, setCurrentEnd] = React.useState(
      new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    );
  const [currentReviewed, setCurrentReviewed] = React.useState(false),
    [currentEvidence, setCurrentEvidence] = React.useState(""),
    [daily, setDaily] = React.useState(false),
    [campaignId, setCampaignId] = React.useState("");
  const [result, setResult] = React.useState<ProgrammeResultPage | null>(null),
    [runs, setRuns] = React.useState<
      {
        id: string;
        created_at: string;
        currentWindow?: { start: string; end: string };
      }[]
    >([]);
  const [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(""),
    [notice, setNotice] = React.useState("");
  const active = React.useRef(true),
    op = React.useRef(0),
    requestKey = React.useRef(crypto.randomUUID());
  React.useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  React.useEffect(() => {
    let stopped = false;
    void programmeCommand<AudienceChoices>(tenantId, { action: "audiences" })
      .then((data) => {
        if (!stopped) setChoices(data);
      })
      .catch((e) => {
        if (!stopped) setError(e.message);
      });
    return () => {
      stopped = true;
    };
  }, [tenantId]);
  React.useEffect(() => {
    setPreview(null);
    setConfirmed(false);
    setPreviewRows([]);
  }, [audience, start, end, spend, transactions, reviewed, evidence]);
  React.useEffect(() => {
    requestKey.current = crypto.randomUUID();
    setResult(null);
  }, [
    baselineId,
    currentStart,
    currentEnd,
    currentReviewed,
    currentEvidence,
    daily,
    campaignId,
  ]);
  React.useEffect(() => {
    let stopped = false;
    setRuns([]);
    if (baselineId)
      void programmeCommand<{ runs: typeof runs }>(tenantId, {
        action: "runs",
        baselineId,
        page: 1,
      })
        .then((data) => {
          if (!stopped) setRuns(data.runs);
        })
        .catch((e) => {
          if (!stopped) setError(e.message);
        });
    return () => {
      stopped = true;
    };
  }, [tenantId, baselineId]);
  async function perform(fn: () => Promise<void>) {
    if (busy) return;
    const version = ++op.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      if (active.current && op.current === version)
        setError(e instanceof Error ? e.message : "The operation failed.");
    } finally {
      if (active.current && op.current === version) setBusy(false);
    }
  }
  async function previewBaseline() {
    await perform(async () => {
      const [kind, id] = audience.split(":");
      const data = await programmeCommand<BaselinePreview>(tenantId, {
        action: "preview_baseline",
        versionId: detail.version.id,
        audience: { kind, id: id ?? null },
        window: { start, end },
        weights: {
          spendWeight: Number(spend),
          transactionsWeight: Number(transactions),
        },
        coverage: { reviewedComplete: reviewed, evidence },
      });
      if (active.current) {
        setPreview(data);
        setPreviewRows(data.baseline.period.customers);
        setPreviewPage(1);
        setConfirmed(false);
      }
    });
  }
  async function saveBaseline() {
    if (!preview || !confirmed) return;
    await perform(async () => {
      const data = await programmeCommand<{ saved: { baselineId: string } }>(
        tenantId,
        {
          action: "confirm_baseline",
          previewId: preview.previewId,
          digest: preview.digest,
          confirmed: true,
        },
      );
      if (active.current) {
        setBaselineId(data.saved.baselineId);
        setNotice(
          "The original cohort and baseline are saved. No reward has been issued.",
        );
        setConfirmed(false);
        await onSaved();
      }
    });
  }
  async function compare() {
    await perform(async () => {
      const data = await programmeCommand<ProgrammeResultPage>(tenantId, {
        action: "run_report",
        baselineId,
        requestKey: requestKey.current,
        window: { start: currentStart, end: currentEnd },
        normalizeDaily: daily,
        coverage: {
          reviewedComplete: currentReviewed,
          evidence: currentEvidence,
        },
        campaignId: campaignId.trim() || null,
      });
      if (active.current) {
        setResult(data);
        const dataRuns = await programmeCommand<{ runs: typeof runs }>(
          tenantId,
          { action: "runs", baselineId, page: 1 },
        );
        if (active.current) setRuns(dataRuns.runs);
      }
    });
  }
  const grid = {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
    gap: 1.5,
  };
  return (
    <Stack spacing={2.5}>
      <Sheet
        variant="outlined"
        sx={{ p: { xs: 2, md: 3 }, borderRadius: "lg" }}
      >
        <Stack spacing={2}>
          <Typography level="h3">1. Capture the starting point</Typography>
          <Typography level="body-md">
            Choose the people and the period. Their original purchase values and
            source evidence stay fixed, even when new POS data arrives.
          </Typography>
          <FormControl>
            <FormLabel>Audience to freeze</FormLabel>
            <Select
              value={audience}
              onChange={(_, value) => value && setAudience(value)}
              disabled={busy}
            >
              <Option value="all_customers">
                All active customer profiles
              </Option>
              <Option value="members">Recorded loyalty members</Option>
              {choices.segments.map((s) => (
                <Option key={s.id} value={`segment:${s.id}`}>
                  {s.name} —{" "}
                  {s.auto_update
                    ? "dynamic membership frozen now"
                    : "static segment"}
                </Option>
              ))}
              {choices.bloomSets.map((s) => (
                <Option key={s.id} value={`bloom_set:${s.id}`}>
                  Bloom: {s.label}
                </Option>
              ))}
            </Select>
          </FormControl>
          <Box sx={grid}>
            <FormControl>
              <FormLabel>Baseline starts</FormLabel>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={busy}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Baseline ends</FormLabel>
              <Input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                disabled={busy}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Spending weight</FormLabel>
              <Input
                value={spend}
                type="number"
                slotProps={{ input: { min: 0, max: 100 } }}
                onChange={(e) => setSpend(e.target.value)}
                disabled={busy}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Transaction weight</FormLabel>
              <Input
                value={transactions}
                type="number"
                slotProps={{ input: { min: 0, max: 100 } }}
                onChange={(e) => setTransactions(e.target.value)}
                disabled={busy}
              />
            </FormControl>
          </Box>
          <Typography level="body-sm">
            Currency: {detail.version.definition.currency}. Business timezone:{" "}
            {detail.version.definition.timezone}. The weighted index uses these
            same settings in every comparison.
          </Typography>
          <Checkbox
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
            disabled={busy}
            label="I have reconciled complete dated order history for this baseline period."
          />
          <FormControl>
            <FormLabel>Source review notes</FormLabel>
            <Textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              minRows={2}
              placeholder="Which POS reports, date coverage and control totals were checked?"
              disabled={busy}
            />
          </FormControl>
          {!reviewed && (
            <Alert variant="soft">
              You can capture an unverified baseline, but growth and loss
              classifications will remain unscored until a separately reviewed
              baseline is created. Bloom will not infer missing purchases.
            </Alert>
          )}
          <Button loading={busy} onClick={() => void previewBaseline()}>
            Review baseline and audience
          </Button>
          {preview && (
            <Sheet variant="soft" sx={{ p: 2, borderRadius: "lg" }}>
              <Stack spacing={1.5}>
                <Typography level="title-lg">
                  {preview.audience.customerCount} customers in this fixed
                  cohort
                </Typography>
                <Typography level="body-sm">
                  {preview.audience.excludedCount} excluded by the selected
                  audience. {preview.audience.unknownCount} have unknown
                  qualifying information.{" "}
                  {preview.baseline.period.unlinkedOrderIds.length} orders lack
                  a customer link.
                </Typography>
                <Box sx={{ overflowX: "auto" }}>
                  <Table
                    size="sm"
                    aria-label="Baseline preview"
                    sx={{ minWidth: 600 }}
                  >
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Recorded spend</th>
                        <th>Transactions</th>
                        <th>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr key={row.customerId}>
                          <td style={{ overflowWrap: "anywhere" }}>
                            {row.customerId}
                          </td>
                          <td>
                            {(row.recordedSpendMinor / 100).toFixed(2)}{" "}
                            {preview.baseline.period.settings.currency}
                          </td>
                          <td>{row.recordedTransactions}</td>
                          <td>
                            {row.orders.length} orders;{" "}
                            {row.missingOrderIds.length} incomplete
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Box>
                <Stack direction="row" gap={1} alignItems="center">
                  {[-1, 1].map((direction) => (
                    <Button
                      key={direction}
                      variant="outlined"
                      size="sm"
                      disabled={
                        busy ||
                        (direction < 0
                          ? previewPage <= 1
                          : previewPage * 50 >= preview.audience.customerCount)
                      }
                      onClick={() =>
                        void perform(async () => {
                          const data =
                            await programmeCommand<BaselinePreviewPage>(
                              tenantId,
                              {
                                action: "preview_page",
                                previewId: preview.previewId,
                                page: previewPage + direction,
                              },
                            );
                          if (active.current) {
                            setPreviewRows(data.rows);
                            setPreviewPage(data.page);
                          }
                        })
                      }
                    >
                      {direction < 0 ? "Previous" : "Next"}
                    </Button>
                  ))}
                  <Typography level="body-sm">Page {previewPage}</Typography>
                </Stack>
                <details>
                  <summary>Exact audience definition</summary>
                  <Box
                    component="pre"
                    sx={{
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                      fontSize: 12,
                    }}
                  >
                    {JSON.stringify(preview.audience.definition, null, 2)}
                  </Box>
                  {preview.audience.notes.map((note) => (
                    <Typography level="body-sm" key={note}>
                      {note}
                    </Typography>
                  ))}
                </details>
                <Checkbox
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  disabled={busy}
                  label={`Save this exact ${preview.audience.customerCount}-customer baseline without issuing rewards.`}
                />
                <Button
                  disabled={!confirmed || busy}
                  onClick={() => void saveBaseline()}
                >
                  Confirm and save baseline
                </Button>
                <Typography level="body-xs">
                  Review valid until{" "}
                  {new Date(preview.expiresAt).toLocaleTimeString()}.
                </Typography>
              </Stack>
            </Sheet>
          )}
        </Stack>
      </Sheet>
      <Sheet
        variant="outlined"
        sx={{ p: { xs: 2, md: 3 }, borderRadius: "lg" }}
      >
        <Stack spacing={2}>
          <Typography level="h3">
            2. Measure the same customers later
          </Typography>
          <Typography level="body-md">
            This produces a saved report. It never replaces the original
            baseline or shrinks the cohort after a customer merge.
          </Typography>
          <FormControl>
            <FormLabel>Saved baseline</FormLabel>
            <Select
              value={baselineId || null}
              placeholder="Save a baseline first"
              onChange={(_, value) => value && setBaselineId(value)}
              disabled={busy}
            >
              {detail.baselines.map((b) => (
                <Option key={b.id} value={b.id}>
                  {b.audience.name} · {b.audience.count ?? "?"} customers ·{" "}
                  {new Date(b.created_at).toLocaleDateString()}
                </Option>
              ))}
            </Select>
          </FormControl>
          <Box sx={grid}>
            <FormControl>
              <FormLabel>Comparison starts</FormLabel>
              <Input
                type="date"
                value={currentStart}
                onChange={(e) => setCurrentStart(e.target.value)}
                disabled={busy}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Comparison ends</FormLabel>
              <Input
                type="date"
                value={currentEnd}
                onChange={(e) => setCurrentEnd(e.target.value)}
                disabled={busy}
              />
            </FormControl>
          </Box>
          <Checkbox
            label="Explicitly compare daily rates when the periods have different lengths."
            checked={daily}
            onChange={(e) => setDaily(e.target.checked)}
            disabled={busy}
          />
          <Checkbox
            label="I have reconciled complete dated order history for this comparison period."
            checked={currentReviewed}
            onChange={(e) => setCurrentReviewed(e.target.checked)}
            disabled={busy}
          />
          <FormControl>
            <FormLabel>Comparison source review notes</FormLabel>
            <Textarea
              minRows={2}
              value={currentEvidence}
              onChange={(e) => setCurrentEvidence(e.target.value)}
              disabled={busy}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Optional email campaign ID</FormLabel>
            <Input
              placeholder="Leave blank for programme-wide comparison"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              disabled={busy}
            />
            <Typography level="body-xs">
              An existing campaign links actual sent messages to later
              purchases. This is an observed outcome, not proof of cause.
            </Typography>
          </FormControl>
          <Button
            disabled={!baselineId}
            loading={busy}
            onClick={() => void compare()}
          >
            Calculate and save comparison
          </Button>
          {runs.length > 0 && (
            <Stack spacing={1}>
              <Typography level="title-md">Saved comparisons</Typography>
              {runs.map((saved) => (
                <Button
                  key={saved.id}
                  variant="outlined"
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      const data = await programmeCommand<ProgrammeResultPage>(
                        tenantId,
                        { action: "get_run", runId: saved.id, page: 1 },
                      );
                      if (active.current) setResult(data);
                    })
                  }
                >
                  {saved.currentWindow?.start ?? "Saved report"} →{" "}
                  {saved.currentWindow?.end ?? ""} ·{" "}
                  {new Date(saved.created_at).toLocaleString()}
                </Button>
              ))}
            </Stack>
          )}
        </Stack>
      </Sheet>
      {error && (
        <Alert role="alert" color="danger">
          {error}
        </Alert>
      )}
      {notice && <Alert color="success">{notice}</Alert>}
      {result && (
        <ProgrammeResultsPanel
          key={result.runId}
          tenantId={tenantId}
          initial={result}
        />
      )}
    </Stack>
  );
}
