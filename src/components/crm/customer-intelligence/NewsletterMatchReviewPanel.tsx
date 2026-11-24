import * as React from "react";
import {
  Accordion, AccordionDetails, AccordionGroup, AccordionSummary,
  Alert, Box, Button, Sheet, Stack, Table, Typography,
} from "@mui/joy";
import { FileSearch } from "lucide-react";
import { mergeSx } from "@/components/joy/mergeSx";
import { IntelligenceActions, IntelligenceNote, IntelligenceStatRow, intelligenceCardPadding, intelligenceCardSx } from "./IntelligenceLayout";
import { decodeIdealCustomerBytes, parseIdealCustomerCsv } from "@/lib/customer-intelligence/idealCustomerTypeExport";
import {
  parseNewsletterCsv, previewNewsletterMatches,
  type NewsletterMatchReview,
} from "@/lib/customer-intelligence/newsletterMatchReview";

/** Local review only. This component never sends file contents to BloomSuite. */
export function NewsletterMatchReviewPanel() {
  const [opened, setOpened] = React.useState(false);
  const [master, setMaster] = React.useState<File | null>(null);
  const [newsletter, setNewsletter] = React.useState<File | null>(null);
  const [review, setReview] = React.useState<NewsletterMatchReview | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const currentRun = React.useRef(0);

  async function inspect() {
    if (!master || !newsletter) return;
    const run = ++currentRun.current;
    setBusy(true); setError(""); setReview(null);
    try {
      if (master.size > 25_000_000 || newsletter.size > 25_000_000)
        throw Error("Each file must be smaller than 25 MB.");
      const [masterText, newsletterText] = await Promise.all([master.arrayBuffer(), newsletter.text()]);
      const results = previewNewsletterMatches(
        parseIdealCustomerCsv(decodeIdealCustomerBytes(masterText)), parseNewsletterCsv(newsletterText),
      );
      if (run === currentRun.current) setReview(results);
    } catch (cause) {
      if (run === currentRun.current) setError(
        cause instanceof Error ? cause.message : "Could not review the selected files.",
      );
    } finally {
      if (run === currentRun.current) setBusy(false);
    }
  }
  function changeFile(which: "master" | "newsletter", value: File | null) {
    ++currentRun.current; setReview(null); setError("");
    if (which === "master") setMaster(value); else setNewsletter(value);
    setBusy(false);
  }
  return (
    <Sheet variant="outlined" sx={mergeSx(intelligenceCardSx, { overflow: "hidden" })}>
      <AccordionGroup>
        <Accordion expanded={opened} onChange={(_, value) => setOpened(value)}>
          <AccordionSummary sx={{ px: intelligenceCardPadding.px, py: 2 }}>
            <Stack direction="row" alignItems="center" gap={1.5}>
              <FileSearch size={18} />
              <Typography level="title-md">Review VIP and newsletter matches</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ px: intelligenceCardPadding.px }}>
            <Stack spacing={3} sx={{ pt: 1, pb: 4 }}>
              <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                Compare your original IdealPOS customer file with a Mailchimp newsletter CSV before importing anything.
                Your files stay in this browser session. No customers, tags, or subscription settings are changed.
              </Typography>
              <IntelligenceNote>
                Exact customer CODE is preferred. A unique email can identify an existing contact.
                Name and phone matches are suggestions only. This does not grant permission to send email or automatically fill missing addresses.
              </IntelligenceNote>
              <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography level="title-sm" sx={{ mb: 1 }}>1. Original IdealPOS Customer Details TXT or CSV</Typography>
                  <Button size="sm" component="label" variant="outlined" color="neutral" disabled={busy}>
                    {master ? master.name : "Choose IdealPOS TXT or CSV"}
                    <input hidden type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(event) =>
                      changeFile("master", event.target.files?.[0] ?? null)} />
                  </Button>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography level="title-sm" sx={{ mb: 1 }}>2. Mailchimp newsletter CSV</Typography>
                  <Button size="sm" component="label" variant="outlined" color="neutral" disabled={busy}>
                    {newsletter ? newsletter.name : "Choose newsletter CSV"}
                    <input hidden type="file" accept=".csv,text/csv" onChange={(event) =>
                      changeFile("newsletter", event.target.files?.[0] ?? null)} />
                  </Button>
                </Box>
              </Stack>
              <IntelligenceActions><Button size="sm" disabled={!master || !newsletter || busy}
                loading={busy} onClick={() => void inspect()}>Preview matches</Button></IntelligenceActions>
              {error && <Alert role="alert" color="warning">{error}</Alert>}
              {review && <>
                <IntelligenceStatRow items={([
                    ["CODE matches", review.exactCode],
                    ["Email matches", review.exactEmail],
                    ["Needs review", review.manualReview],
                    ["Unmatched", review.unmatched],
                  ] as const).map(([title, count]) => ({ label: title, value: count.toLocaleString(), icon: <FileSearch /> }))} />
                <Typography level="body-sm">
                  {review.total.toLocaleString()} newsletter rows checked.
                  {" "}{review.eligibleEmailCandidates.toLocaleString()} exact CODE matches have an email that is missing from the IdealPOS file.
                  Those addresses still require review before any update.
                </Typography>
                <Typography level="title-sm">First 20 records needing attention</Typography>
                <Box sx={{ overflowX: "auto" }}>
                  <Table size="sm" aria-label="Newsletter matching review">
                    <thead><tr><th>CSV row</th><th>Why it needs review</th></tr></thead>
                    <tbody>
                      {review.rows.filter((row) => row.decision === "manual_review" || row.decision === "unmatched")
                        .slice(0, 20).map((row) => (
                          <tr key={row.row}><td>{row.row}</td><td>{row.reason}</td></tr>
                        ))}
                    </tbody>
                  </Table>
                </Box>
                <Typography level="body-xs">
                  This is a matching preview, not an import. Overlapping VIP and Newsletter membership must remain separate,
                  and unsubscribed contacts must stay excluded from campaigns. Review uncertain matches against the original customer CODE.
                </Typography>
              </>}
            </Stack>
          </AccordionDetails>
        </Accordion>
      </AccordionGroup>
    </Sheet>
  );
}
