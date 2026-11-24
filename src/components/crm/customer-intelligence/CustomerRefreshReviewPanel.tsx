import * as React from "react";
import {
  Accordion, AccordionDetails, AccordionGroup, AccordionSummary,
  Alert, Box, Button, Checkbox, Sheet, Stack, Table, Typography,
} from "@mui/joy";
import { ClipboardCheck } from "lucide-react";
import { mergeSx } from "@/components/joy/mergeSx";
import { IntelligenceActions, IntelligenceNote, IntelligenceStatRow, intelligenceCardPadding, intelligenceCardSx } from "./IntelligenceLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  decodeIdealCustomerBytes, parseIdealCustomerCsv, type IdealCustomerRow,
} from "@/lib/customer-intelligence/idealCustomerTypeExport";
import {
  reviewIdealCustomerRefresh, type CustomerRefreshReview,
} from "@/lib/customer-intelligence/customerRefreshReview";
import {
  IDEAL_CONTACT_UPDATE_FIELDS, prepareIdealContactUpdates,
  type IdealContactUpdateField,
} from "@/lib/customer-intelligence/idealContactRefreshPlan";

const BATCH_SIZE = 200;
type ReviewedPlan = { planId: string; digest: string; count: number };
type RpcCaller = (
  name: string, args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
async function invokeReviewRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const call = supabase.rpc as unknown as RpcCaller;
  const result = await call(name, args);
  if (result.error) throw Error(result.error.message);
  return result.data;
}
async function fileDigest(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Local comparison first. Remote staging and writes require separate deliberate actions. */
export function CustomerRefreshReviewPanel({ tenantId }: { tenantId: string }) {
  const [opened, setOpened] = React.useState(false);
  const [previous, setPrevious] = React.useState<File | null>(null);
  const [current, setCurrent] = React.useState<File | null>(null);
  const [rows, setRows] = React.useState<{ old: IdealCustomerRow[]; next: IdealCustomerRow[] } | null>(null);
  const [report, setReport] = React.useState<CustomerRefreshReview | null>(null);
  const [selected, setSelected] = React.useState<IdealContactUpdateField[]>([]);
  const [offset, setOffset] = React.useState(0);
  const [staged, setStaged] = React.useState<ReviewedPlan | null>(null);
  const [approved, setApproved] = React.useState(false);
  const [completed, setCompleted] = React.useState(0);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const requestId = React.useRef(0);

  const proposed = React.useMemo(() => {
    if (!rows || !report || report.errors.length) return [];
    try { return prepareIdealContactUpdates(rows.old, rows.next, selected); }
    catch { return []; }
  }, [rows, report, selected]);
  const currentBatch = proposed.slice(offset, offset + BATCH_SIZE);
  const totalBatches = Math.ceil(proposed.length / BATCH_SIZE);

  function resetReview() {
    requestId.current++;
    setBusy(false); setError(""); setReport(null); setRows(null);
    setStaged(null); setApproved(false); setOffset(0); setCompleted(0);
  }
  function selectFile(which: "previous" | "current", value: File | null) {
    resetReview();
    if (which === "previous") setPrevious(value); else setCurrent(value);
  }
  async function review() {
    if (!previous || !current) return;
    const run = ++requestId.current;
    setError(""); setReport(null); setRows(null); setStaged(null); setBusy(true);
    setApproved(false); setOffset(0); setCompleted(0);
    try {
      if (previous.size > 25_000_000 || current.size > 25_000_000)
        throw Error("Each customer file must be smaller than 25 MB.");
      const [before, after] = await Promise.all([previous.arrayBuffer(), current.arrayBuffer()]);
      const original = parseIdealCustomerCsv(decodeIdealCustomerBytes(before));
      const refreshed = parseIdealCustomerCsv(decodeIdealCustomerBytes(after));
      const compared = reviewIdealCustomerRefresh(original, refreshed);
      if (run === requestId.current) {
        setRows({ old: original, next: refreshed });
        setReport(compared);
      }
    } catch (cause) {
      if (run === requestId.current) setError(
        cause instanceof Error ? cause.message : "Unable to compare customer files.",
      );
    } finally {
      if (run === requestId.current) setBusy(false);
    }
  }

  async function stage() {
    if (!current || !rows || report?.errors.length || !currentBatch.length || staged) return;
    const run = ++requestId.current;
    setError(""); setBusy(true); setApproved(false);
    try {
      const hash = await fileDigest(current);
      const raw = await invokeReviewRpc("stage_ideal_contact_refresh", {
        p_tenant: tenantId, p_source_sha256: hash, p_changes: currentBatch,
      });
      if (!raw || typeof raw !== "object") throw Error("No verified staging receipt was returned.");
      const result = raw as Record<string, unknown>;
      if (typeof result.planId !== "string" || typeof result.digest !== "string" ||
          result.count !== currentBatch.length) throw Error("Staging receipt did not match the exact batch.");
      if (run === requestId.current)
        setStaged({ planId: result.planId, digest: result.digest, count: result.count });
    } catch (cause) {
      if (run === requestId.current) setError(
        cause instanceof Error ? cause.message : "Refresh changes were not staged.",
      );
    } finally {
      if (run === requestId.current) setBusy(false);
    }
  }
  async function apply() {
    if (!staged || !approved || busy) return;
    const run = ++requestId.current;
    setError(""); setBusy(true);
    try {
      const raw = await invokeReviewRpc("apply_ideal_contact_refresh", {
        p_tenant: tenantId, p_plan_id: staged.planId, p_digest: staged.digest,
      });
      if (!raw || typeof raw !== "object" ||
          (raw as Record<string, unknown>).status !== "applied" ||
          (raw as Record<string, unknown>).updatedFields !== staged.count)
        throw Error("The application result needs reconciliation before another batch.");
      if (run === requestId.current) {
        setCompleted((count) => count + staged.count);
        setOffset((count) => count + staged.count);
        setStaged(null); setApproved(false);
      }
    } catch (cause) {
      if (run === requestId.current) setError(
        cause instanceof Error ? cause.message : "Approval was not confirmed.",
      );
    } finally {
      if (run === requestId.current) setBusy(false);
    }
  }

  return <Sheet variant="outlined" sx={mergeSx(intelligenceCardSx, { overflow: "hidden" })}>
    <AccordionGroup>
      <Accordion expanded={opened} onChange={(_, value) => setOpened(value)}>
        <AccordionSummary sx={{ px: intelligenceCardPadding.px, py: 2 }}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <ClipboardCheck size={18}/>
            <Typography level="title-md">Review an updated IdealPOS customer file</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ px: intelligenceCardPadding.px }}>
          <Stack spacing={3} sx={{ pt: 1, pb: 4 }}>
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              Compare the previous and refreshed Customer Details exports.
              Exact customer CODEs are preserved, including leading zeros.
              Comparing files stays in your browser and changes nothing.
            </Typography>
            <IntelligenceNote>
              For contact updates, review the differences, deliberately stage one batch,
              and separately approve that exact batch. Only selected changed fields
              are sent to BloomSuite for staging. The original CSV files stay on your device.
              Existing newer CRM values stop conflicting updates. No customer is created,
              merged or deleted, and email or SMS permission is never granted.
            </IntelligenceNote>
            <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
              <Box sx={{ flex: 1 }}>
                <Typography level="title-sm" sx={{ mb: 1 }}>1. Previous original Customer Details TXT or CSV</Typography>
                <Button size="sm" component="label" color="neutral" variant="outlined" disabled={busy}>
                  {previous ? previous.name : "Choose previous file"}
                  <input hidden type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(event) =>
                    selectFile("previous", event.target.files?.[0] ?? null)}/>
                </Button>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography level="title-sm" sx={{ mb: 1 }}>2. Refreshed original Customer Details TXT or CSV</Typography>
                <Button size="sm" component="label" color="neutral" variant="outlined" disabled={busy}>
                  {current ? current.name : "Choose refreshed file"}
                  <input hidden type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(event) =>
                    selectFile("current", event.target.files?.[0] ?? null)}/>
                </Button>
              </Box>
            </Stack>
            <IntelligenceActions><Button size="sm" disabled={!previous || !current || busy} loading={busy}
              onClick={() => void review()}>Compare customer files</Button></IntelligenceActions>
            {error && <Alert color="warning" role="alert">{error}</Alert>}
            {report && <>
              {report.errors.map((message) => <Alert color="warning" key={message}>{message}</Alert>)}
              {!report.errors.length && <>
                <IntelligenceStatRow items={([
                    ["Unchanged records", report.unchanged],
                    ["Changed records", report.changed],
                    ["New customer codes", report.added],
                    ["Absent from new file", report.missingFromCurrent],
                  ] as const).map(([title, count]) => ({ label: title, value: count.toLocaleString(), icon: <ClipboardCheck /> }))} />
                <Typography level="body-sm">
                  {report.contactChanges} records have an email or phone change; {report.nameChanges} have a name change;
                  {" "}{report.classificationChanges} have a TYPE or MAILOUT change;
                  {" "}{report.protectedFieldChanges} have an account or price-level change.
                  A blank refreshed field never erases an existing value.
                </Typography>
                <Typography level="title-sm">First 20 records with differences</Typography>
                <Box sx={{ overflowX: "auto" }}>
                  <Table size="sm" aria-label="IdealPOS customer refresh differences">
                    <thead><tr><th>Exact CODE</th><th>Fields that differ</th><th>Review</th></tr></thead>
                    <tbody>{report.changes.slice(0, 20).map((entry) => (
                      <tr key={entry.code}>
                        <td>{entry.code}</td><td>{entry.fields.join(", ")}</td>
                        <td>{entry.requiresReview ? "Required" : "Names only"}</td>
                      </tr>
                    ))}</tbody>
                  </Table>
                </Box>
                <Sheet variant="soft" color="neutral" sx={{ p: 3, borderRadius: "lg" }}>
                  <Stack spacing={1.5}>
                    <Typography level="title-md">Apply reviewed contact updates</Typography>
                    <Typography level="body-sm">
                      Choose the fields to update in BloomSuite. Name corrections use
                      the separate names-only process. ACCOUNT and PRICELEVEL are protected.
                      TYPE and MAILOUT are IdealPOS source labels, not mailing consent.
                      This does not write changes back to IdealPOS.
                    </Typography>
                    <Stack direction="row" gap={1.5} flexWrap="wrap">
                      {IDEAL_CONTACT_UPDATE_FIELDS.map((field) => <Checkbox key={field}
                        label={field === "EMAIL" ? "Email" : field === "MOBILE" ? "Phone" : field === "TYPE" ? "Customer TYPE" : "Ideal MAILOUT"}
                        checked={selected.includes(field)} disabled={busy || Boolean(staged)}
                        onChange={(event) => {
                          const next = event.target.checked;
                          setSelected((existing) => next ? [...existing, field] : existing.filter((item) => item !== field));
                          setOffset(0); setCompleted(0); setApproved(false); setError("");
                        }} />)}
                    </Stack>
                    <Typography level="body-sm">
                      {proposed.length.toLocaleString()} selected field changes.
                      {proposed.length > 0 && ` Batch ${Math.min(totalBatches, Math.floor(offset / BATCH_SIZE) + 1)} of ${totalBatches} (maximum 200 changes per approval).`}
                    </Typography>
                    {completed > 0 && <Alert color="neutral">{completed.toLocaleString()} fields applied in approved batches. The complete files remain unchanged.</Alert>}
                    {!staged && currentBatch.length > 0 && <Button size="sm" sx={{ alignSelf: "flex-start" }} variant="outlined" color="neutral"
                      disabled={busy} loading={busy} onClick={() => void stage()}>
                      Stage the next {currentBatch.length} changes for review
                    </Button>}
                    {staged && <>
                      <Typography level="body-sm">
                        Exact batch staged: {staged.count} fields. Plan expires after 30 minutes.
                        Any identity, contact or permission conflict stops the entire batch.
                        No changes are applied until you approve below.
                      </Typography>
                      <Checkbox checked={approved} disabled={busy}
                        onChange={(event) => setApproved(event.target.checked)}
                        label="I reviewed these exact source differences and approve these BloomSuite updates, without changing marketing consent or IdealPOS." />
                      <Button size="sm" sx={{ alignSelf: "flex-end" }} disabled={!approved || busy} loading={busy} onClick={() => void apply()}>
                        Apply approved {staged.count} field changes
                      </Button>
                    </>}
                    {proposed.length === 0 && selected.length > 0 &&
                      <Typography level="body-sm">No nonblank changes in the selected fields.</Typography>}
                    {completed === proposed.length && completed > 0 &&
                      <Typography level="body-sm">All selected updates have completed. Review current customer profiles before using them in a campaign.</Typography>}
                  </Stack>
                </Sheet>
              </>}
            </>}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </AccordionGroup>
  </Sheet>;
}
