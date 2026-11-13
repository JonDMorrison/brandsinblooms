import * as React from "react";
import {
  Accordion, AccordionDetails, AccordionGroup, AccordionSummary,
  Alert, Box, Button, Sheet, Stack, Table, Typography,
} from "@mui/joy";
import { ClipboardCheck } from "lucide-react";
import { parseIdealCustomerCsv } from "@/lib/customer-intelligence/idealCustomerTypeExport";
import {
  reviewIdealCustomerRefresh,
  type CustomerRefreshReview,
} from "@/lib/customer-intelligence/customerRefreshReview";

/** Local-only comparison of complete original and refreshed IdealPOS master files. */
export function CustomerRefreshReviewPanel() {
  const [opened, setOpened] = React.useState(false);
  const [previous, setPrevious] = React.useState<File | null>(null);
  const [current, setCurrent] = React.useState<File | null>(null);
  const [report, setReport] = React.useState<CustomerRefreshReview | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const requestId = React.useRef(0);
  const selectFile = (which: "previous" | "current", value: File | null) => {
    requestId.current++; setBusy(false); setError(""); setReport(null);
    if (which === "previous") setPrevious(value); else setCurrent(value);
  };
  async function review() {
    if (!previous || !current) return;
    const run = ++requestId.current;
    setError(""); setReport(null); setBusy(true);
    try {
      if (previous.size > 25_000_000 || current.size > 25_000_000)
        throw Error("Each customer file must be smaller than 25 MB.");
      const [before, after] = await Promise.all([previous.text(), current.text()]);
      const compared = reviewIdealCustomerRefresh(
        parseIdealCustomerCsv(before), parseIdealCustomerCsv(after),
      );
      if (run === requestId.current) setReport(compared);
    } catch (cause) {
      if (run === requestId.current) setError(
        cause instanceof Error ? cause.message : "Unable to compare customer files.",
      );
    } finally {
      if (run === requestId.current) setBusy(false);
    }
  }
  return <Sheet variant="outlined" sx={{ borderRadius: "xl" }}>
    <AccordionGroup>
      <Accordion expanded={opened} onChange={(_, value) => setOpened(value)}>
        <AccordionSummary>
          <Stack direction="row" alignItems="center" gap={1}>
            <ClipboardCheck size={19}/>
            <Typography level="title-lg">Review an updated IdealPOS customer file</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2} sx={{ pt: 1, pb: 2 }}>
            <Typography level="body-sm">
              Compare the previous and refreshed Customer Details exports before replacing information.
              Customer codes are matched exactly, including leading zeros.
              Both files stay in your browser. Nothing is uploaded or changed.
            </Typography>
            <Alert color="neutral" variant="soft">
              This shows differences only. It never merges customers, removes people missing from a newer file,
              changes customer types or gives someone email permission.
              Email, phone, MAILOUT and other changes need separate review before they can be applied.
            </Alert>
            <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
              <Box sx={{ flex: 1 }}>
                <Typography level="title-sm" sx={{ mb: 1 }}>1. Previous original Customer Details CSV</Typography>
                <Button component="label" color="neutral" variant="outlined" disabled={busy}>
                  {previous ? previous.name : "Choose previous file"}
                  <input hidden type="file" accept=".csv,text/csv" onChange={(event) =>
                    selectFile("previous", event.target.files?.[0] ?? null)}/>
                </Button>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography level="title-sm" sx={{ mb: 1 }}>2. Refreshed original Customer Details CSV</Typography>
                <Button component="label" color="neutral" variant="outlined" disabled={busy}>
                  {current ? current.name : "Choose refreshed file"}
                  <input hidden type="file" accept=".csv,text/csv" onChange={(event) =>
                    selectFile("current", event.target.files?.[0] ?? null)}/>
                </Button>
              </Box>
            </Stack>
            <Button disabled={!previous || !current || busy} loading={busy}
              color="neutral" onClick={() => void review()}>Compare customer files</Button>
            {error && <Alert color="warning" role="alert">{error}</Alert>}
            {report && <>
              {report.errors.map((message) => <Alert color="warning" key={message}>{message}</Alert>)}
              {!report.errors.length && <>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, gap: 1 }}>
                  {([
                    ["Unchanged records", report.unchanged],
                    ["Changed records", report.changed],
                    ["New customer codes", report.added],
                    ["Absent from new file", report.missingFromCurrent],
                  ] as const).map(([title, count]) => <Sheet key={title} variant="soft" color="neutral"
                      sx={{ p: 1.5, borderRadius: "lg" }}>
                    <Typography level="h4">{count.toLocaleString()}</Typography>
                    <Typography level="body-sm">{title}</Typography>
                  </Sheet>)}
                </Box>
                <Typography level="body-sm">
                  {report.contactChanges} records have an email or phone change; {report.nameChanges} have a name change;
                  {" "}{report.classificationChanges} have a TYPE or MAILOUT change;
                  {" "}{report.protectedFieldChanges} have an account or price-level change.
                  No blank refreshed field is treated as a request to erase an existing value.
                </Typography>
                <Typography level="title-sm">First 20 records with differences</Typography>
                <Box sx={{ overflowX: "auto" }}>
                  <Table size="sm" aria-label="IdealPOS customer refresh differences">
                    <thead><tr><th>Exact CODE</th><th>Fields that differ</th><th>Review</th></tr></thead>
                    <tbody>{report.changes.slice(0, 20).map((entry) => (
                      <tr key={entry.code}>
                        <td>{entry.code}</td>
                        <td>{entry.fields.join(", ")}</td>
                        <td>{entry.requiresReview ? "Required" : "Names only"}</td>
                      </tr>
                    ))}</tbody>
                  </Table>
                </Box>
                {report.changes.length > 20 && <Typography level="body-xs">
                  Showing 20 of {report.changes.length} differences. No changes have been applied.
                </Typography>}
              </>}
            </>}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </AccordionGroup>
  </Sheet>;
}
