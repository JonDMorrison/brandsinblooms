import * as React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionGroup,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  Option,
  Select,
  Sheet,
  Stack,
  Table,
  Typography,
} from "@mui/joy";
import { Download, FileSpreadsheet } from "lucide-react";
import { NewsletterMatchReviewPanel } from "./NewsletterMatchReviewPanel";
import { CustomerRefreshReviewPanel } from "./CustomerRefreshReviewPanel";
import { useUserRole } from "@/hooks/useUserRole";
import { fetchEmailReachability, type TenantAudienceHealth } from "@/hooks/useTenantAudienceHealth";
import { supabase } from "@/integrations/supabase/client";
import { readAllPages } from "../../../../supabase/functions/_shared/customer-intelligence/query-pages";
import {
  draftIdealCustomerTypeCsv,
  idealAudienceReviewKey,
  decodeIdealCustomerBytes,
  parseIdealCustomerCsv,
  reviewIdealCustomerTypeExport,
  type IdealCustomerRow,
  type IdealExportPreview,
  type IdealIdentityLink,
} from "@/lib/customer-intelligence/idealCustomerTypeExport";

type Segment = { id: string; name: string };
const unique = (values: string[]) => [...new Set(values)];

export function IdealCustomerTypeExportPanel({
  tenantId, requestedSegmentId,
}: {
  tenantId: string;
  requestedSegmentId?: string | null;
}) {
  const { role, hasPermission, tenantId: activeTenantId } = useUserRole();
  if (
    !["owner_admin", "marketing"].includes(role ?? "") ||
    !hasPermission("loyalty.write") ||
    activeTenantId !== tenantId
  )
    return null;
  return (
    <Stack spacing={2}>
      <NewsletterMatchReviewPanel key={tenantId + "-newsletter-match"} />
      <CustomerRefreshReviewPanel key={tenantId + "-customer-refresh"} tenantId={tenantId} />
      <IdealCustomerTypeExportWorksheet key={tenantId+":"+(requestedSegmentId??"")} tenantId={tenantId} requestedSegmentId={requestedSegmentId} />
    </Stack>
  );
}

/** Preview is browser-local. No PII from the full Ideal customer file is uploaded or persisted. */
export function IdealCustomerTypeExportWorksheet({
  tenantId, requestedSegmentId,
}: {
  tenantId: string;
  requestedSegmentId?: string | null;
}) {
  const requested = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestedSegmentId??"") ? requestedSegmentId! : null;
  const [opened, setOpened] = React.useState(Boolean(requested));
  const [segments, setSegments] = React.useState<Segment[]>([]);
  const [segmentId, setSegmentId] = React.useState("");
  const [sourceFileName, setSourceFileName] = React.useState("");
  const [sourceRows, setSourceRows] = React.useState<IdealCustomerRow[]>([]);
  const [newType, setNewType] = React.useState("");
  const [preview, setPreview] = React.useState<IdealExportPreview | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);
  const [reviewKey,setReviewKey]=React.useState<string|null>(null);
  const [health,setHealth]=React.useState<TenantAudienceHealth|null>(null);
  const [healthError,setHealthError]=React.useState("");
  const initialSelection=React.useRef(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  React.useEffect(() => {
    setPreview(null);
    setConfirmed(false);
    setReviewKey(null);
    setHealth(null);
    setHealthError("");
  }, [newType, sourceRows, segmentId]);

  React.useEffect(() => {
    if (!opened) return;
    let valid = true;
    void readAllPages<Segment>((from, to) =>
      supabase
        .from("crm_segments")
        .select("id,name")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .is("deleted_at", null)
        .order("id")
        .range(from, to),
    )
      .then((items) => {
        if (valid) {
          setSegments(items);
          if(requested&&!initialSelection.current){
            initialSelection.current=true;
            if(items.some(s=>s.id===requested))setSegmentId(requested);
            else setError("The requested audience is not available in this company. Choose an active saved audience.");
          }
        }
      })
      .catch((e) => {
        if (valid)
          setError(
            e instanceof Error
              ? e.message
              : "Saved audiences could not be loaded.",
          );
      });
    return () => {
      valid = false;
    };
  }, [tenantId, opened, requested]);

  async function readSource(file: File) {
    if (!/\.(csv|txt)$/i.test(file.name) || file.size > 25_000_000) {
      setPreview(null);setConfirmed(false);setReviewKey(null);setSourceRows([]);setSourceFileName("");
      setError(
        "Choose the original IdealPOS TXT/CSV or nine-column review CSV (maximum 25 MB). Do not open and re-save it in Excel.",
      );
      return;
    }
    setError("");
    setBusy(true);
    setPreview(null);
    setConfirmed(false);
    try {
      const rows = parseIdealCustomerCsv(decodeIdealCustomerBytes(await file.arrayBuffer()));
      if (mounted.current) {
        setSourceRows(rows);
        setSourceFileName(file.name);
        setNewType("");
      }
    } catch (e) {
      if (mounted.current) {
        setSourceRows([]);
        setSourceFileName("");
        setError(
          e instanceof Error ? e.message : "Customer file could not be read.",
        );
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function readAudience(selectedId:string){
      const {data:segment,error:segmentError}=await supabase.from("crm_segments").select("id,customer_count").eq("tenant_id",tenantId).eq("id",selectedId).eq("status","active").is("deleted_at",null).maybeSingle();
      if(segmentError||!segment)throw Error("The selected audience is no longer available in this company.");
      const members = await readAllPages<{ customer_id: string }>((from, to) =>
        supabase
          .from("customer_segments")
          .select("customer_id")
          .eq("segment_id", selectedId)
          .order("customer_id")
          .range(from, to),
      );
      const ids = members.map((member) => member.customer_id);
      if (
        ids.length === 0 ||
        ids.length > 100_000 ||
        unique(ids).length !== ids.length
      )
        throw new Error(
          "The selected segment is empty, duplicated, or larger than the reviewed export limit.",
        );
      const links: IdealIdentityLink[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        if (!mounted.current) throw Error('Workspace changed.');
        const chunk = ids.slice(i, i + 200);
        const [customers, idealLinks] = await Promise.all([
          supabase
            .from("crm_customers")
            .select("id,deleted_at,merged_into_customer_id")
            .eq("tenant_id", tenantId)
            .in("id", chunk),
          readAllPages<IdealIdentityLink>((from, to) =>
            supabase
              .from("crm_customer_identity_links")
              .select("crm_customer_id,external_id,provider")
              .eq("tenant_id", tenantId)
              .eq("provider", "ideal")
              .in("crm_customer_id", chunk)
              .order("external_id")
              .range(from, to),
          ),
        ]);
        if (customers.error) throw customers.error;
        if (
          (customers.data ?? []).length !== chunk.length ||
          customers.data?.some((c) => c.deleted_at || c.merged_into_customer_id)
        ) {
          throw new Error(
            "At least one saved segment member is missing, merged or inaccessible. Review identity changes before exporting.",
          );
        }
        links.push(...idealLinks);
      }
      if(segment.customer_count!==ids.length)throw Error("The saved audience count needs reconciliation. Refresh the segment before exporting.");
      return {ids,links,key:idealAudienceReviewKey(selectedId,ids,links)};
  }
  async function review(excludedMissingSourceCodes?: readonly string[]) {
    if (!segmentId || !sourceRows.length || !newType || busy) return;
    setBusy(true);
    setError("");
    setPreview(null);
    setConfirmed(false);
    setReviewKey(null);
    setHealth(null);setHealthError("");
    try {
      const {ids,links,key}=await readAudience(segmentId);
      const result = reviewIdealCustomerTypeExport({
        originalRows: sourceRows,
        audienceCustomerIds: ids,
        identityLinks: links,
        newType,
        excludedMissingSourceCodes,
        confirmedExistingTypes: unique(
          sourceRows.map((r) => r.TYPE).filter(Boolean),
        ),
      });
      if (mounted.current) {setPreview(result);setReviewKey(key);}
      try{
        const counts=await fetchEmailReachability(tenantId,ids);
        if(counts.total!==ids.length)throw Error("Reachability did not cover the exact selected audience.");
        if(mounted.current)setHealth(counts);
      }catch{
        if(mounted.current)setHealthError("Email readiness is unavailable. Do not assume these customers can receive a campaign.");
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error
            ? e.message
            : "Unable to verify the selected audience.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function exportReview() {
    if (!confirmed || preview?.state !== "ready_to_review" || !mounted.current || !reviewKey || busy)
      return;
    setBusy(true);setError("");
    try {
      const current=await readAudience(segmentId);
      if(!mounted.current)return;
      if(current.key!==reviewKey)throw Error("The audience or its IdealPOS codes changed after review. Review the exact audience again before downloading.");
      const csv = draftIdealCustomerTypeCsv(preview);
      const blob = new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = "IDEAL-CUSTOMER-TYPE-REVIEW-ONLY.csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if(mounted.current){
        setConfirmed(false);setPreview(null);setReviewKey(null);setHealth(null);
        setError(e instanceof Error?e.message:"Review-only file could not be created.");
      }
    } finally {if(mounted.current)setBusy(false);}
  }
  const knownTypes = unique(sourceRows.map((row) => row.TYPE).filter(Boolean));
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "xl" }}>
      <AccordionGroup>
        <Accordion expanded={opened} onChange={(_, value) => setOpened(value)}>
          <AccordionSummary>
            <Stack direction="row" gap={1} alignItems="center">
              <FileSpreadsheet size={19} />
              <Typography level="title-lg">
                IdealPOS Customer Type bridge
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2} sx={{ pt: 1, pb: 2 }}>
              <Typography level="body-md">
                Select a saved BloomSuite audience, match it by the original
                Ideal customer CODE, and preview a complete customer-file
                update. No weekly sync will automatically reassign Ideal
                Customer Types.
              </Typography>
              <Alert variant="soft" color="warning">
                Review-only workflow. Do not import this file into IdealPOS
                until Ideal support confirms whether their customer update
                safely matches CODE, preserves other fields, and accepts this
                exact CSV format.
              </Alert>
              <FormControl>
                <FormLabel>Saved audience</FormLabel>
                <Select
                  placeholder="Choose a reviewed static or dynamic segment"
                  value={segmentId || null}
                  onChange={(_, value) => setSegmentId(value ?? "")}
                  disabled={busy}
                >
                  {segments.map((s) => (
                    <Option key={s.id} value={s.id}>
                      {s.name}
                    </Option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Original Ideal Customer Details export</FormLabel>
                <Button variant="outlined" component="label" disabled={busy}>
                  Choose original TXT or CSV
                  <input
                    hidden
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    onChange={(event) => {
                      const f = event.target.files?.[0];
                      if (f) void readSource(f);
                    }}
                  />
                </Button>
                {sourceRows.length > 0 && (
                  <Typography level="body-sm">
                    {sourceFileName} · {sourceRows.length} customer records ·
                    only kept in this browser session
                  </Typography>
                )}
              </FormControl>
              {sourceRows.length > 0 && (
                <FormControl>
                  <FormLabel>Existing Ideal Customer Type to assign</FormLabel>
                  <Select
                    placeholder="Choose a TYPE already present in the source"
                    value={newType || null}
                    onChange={(_, value) => setNewType(value ?? "")}
                    disabled={busy}
                  >
                    {knownTypes.map((type) => (
                      <Option key={type} value={type}>
                        {type}
                      </Option>
                    ))}
                  </Select>
                  <Typography level="body-xs">
                    A new or currently unused TYPE requires a confirmed list of
                    Ideal’s configured 20 types. It must not be guessed.
                  </Typography>
                </FormControl>
              )}
              <Button
                loading={busy}
                disabled={!segmentId || !sourceRows.length || !newType}
                onClick={() => void review()}
              >
                Verify selected audience and preview
              </Button>
              {preview && (
                <Stack spacing={1.5}>
                  <Typography level="title-lg">
                    {preview.state === "blocked"
                      ? "Needs reconciliation before export"
                      : "Ready for manual review"}
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr 1fr",
                        md: "repeat(4,1fr)",
                      },
                      gap: 1.5,
                    }}
                  >
                    {(
                      [
                        ["Customers selected", preview.selectedCustomers],
                        ["Exact CODE matches", preview.matchedCustomers],
                        ["TYPE changes", preview.rowsChanged],
                        ["Already assigned", preview.rowsAlreadyAssigned],
                      ] as const
                    ).map(([label, value]) => (
                      <Sheet
                        variant="soft"
                        sx={{ p: 1.5, borderRadius: "lg" }}
                        key={label}
                      >
                        <Typography level="body-xs">{label}</Typography>
                        <Typography level="title-lg">{value}</Typography>
                      </Sheet>
                    ))}
                  </Box>
                  {health&&<Sheet variant="soft" sx={{p:1.5,borderRadius:"lg"}}><Stack spacing={0.5}>
                    <Typography level="title-sm">Email readiness for this exact audience</Typography>
                    <Typography level="body-sm">{health.confirmed.toLocaleString()} reachable · {health.pending.toLocaleString()} waiting for permission · {health.optedOut.toLocaleString()} opted out · {health.suppressed.toLocaleString()} unsendable</Typography>
                    <Typography level="body-xs">This is the CRM email readiness count, not a send approval. The POS audience and marketing audience remain separate. Final campaign checks still apply.</Typography>
                  </Stack></Sheet>}
                  {healthError&&<Alert color="neutral">{healthError}</Alert>}
                  {preview.errors.map((msg) => (
                    <Alert key={msg} color="danger">
                      {msg}
                    </Alert>
                  ))}
                  {preview.unknownCustomerCodes.length > 0 && (
                    <Typography level="body-sm">
                      {preview.excludedMissingSourceCodes.length ? "Reviewed exclusions (not in the source file):" : "Customer codes missing from the source:"}{" "}
                      {preview.unknownCustomerCodes.slice(0, 10).join(", ")}
                      {preview.unknownCustomerCodes.length > 10
                        ? ` and ${preview.unknownCustomerCodes.length - 10} more`
                        : ""}
                      .
                    </Typography>
                  )}
                  {preview.state === "blocked" && preview.unknownCustomerCodes.length > 0 &&
                    preview.matchedCustomers > 0 &&
                    preview.errors.every(msg => msg.includes("selected Ideal codes were not found") || msg.startsWith("Source file match:")) && (
                    <Sheet variant="soft" sx={{ p: 1.5, borderRadius: "lg" }}>
                      <Stack spacing={1}>
                        <Typography level="body-sm">
                          The original file does not contain these codes. You can upload a newer master or review an export that excludes exactly these customers. Their BloomSuite segment membership stays unchanged.
                        </Typography>
                        <Button variant="outlined" color="neutral" disabled={busy}
                          onClick={() => void review(preview.unknownCustomerCodes)}>
                          Review export excluding {preview.unknownCustomerCodes.length} missing codes
                        </Button>
                      </Stack>
                    </Sheet>
                  )}
                  {preview.excludedMissingSourceCodes.length > 0 && (
                    <Alert variant="soft" color="neutral">
                      {preview.matchedCustomers} of {preview.selectedCustomers} selected customers are included in this reviewed POS update. {preview.excludedMissingSourceCodes.length} missing codes are excluded; the CRM segment is unchanged. Every original master row remains in the file.
                    </Alert>
                  )}
                  <Typography level="body-sm">
                    Existing customer types being replaced:{" "}
                    {Object.entries(preview.oldTypeCounts)
                      .map(([type, count]) => `${type || "(blank)"} (${count})`)
                      .join(", ") || "none"}
                    . All unrelated customer rows and the eight other fields
                    remain unchanged.
                  </Typography>
                  <Box sx={{ overflowX: "auto" }}>
                    <Table
                      size="sm"
                      aria-label="Customer Type change preview"
                      sx={{ minWidth: 470 }}
                    >
                      <thead>
                        <tr>
                          <th>CODE (text)</th>
                          <th>Current TYPE</th>
                          <th>Proposed TYPE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.changedCodes.slice(0, 25).map((code) => (
                          <tr key={code}>
                            <td>{code}</td>
                            <td>
                              {sourceRows.find((r) => r.CODE === code)?.TYPE ||
                                "(blank)"}
                            </td>
                            <td>{preview.newType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Box>
                  {preview.changedCodes.length > 25 && (
                    <Typography level="body-xs">
                      Showing 25 of {preview.changedCodes.length} affected
                      customers. Export contains all original source rows.
                    </Typography>
                  )}
                  <Checkbox
                    checked={confirmed}
                    disabled={preview.state !== "ready_to_review" || busy}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    label={preview.excludedMissingSourceCodes.length
                      ? `I reviewed the ${preview.matchedCustomers} matched customers, the ${preview.excludedMissingSourceCodes.length} excluded codes and the TYPE changes. This is not an approved IdealPOS import.`
                      : "I reviewed the complete audience and TYPE changes, and understand this is not an approved IdealPOS import."}
                  />
                  <Button
                    variant="outlined"
                    startDecorator={<Download size={16} />}
                    disabled={
                      !confirmed ||
                      preview.state !== "ready_to_review" ||
                      !preview.rowsChanged ||
                      busy
                    }
                    onClick={()=>void exportReview()}
                  >
                    Download review-only customer CSV
                  </Button>
                </Stack>
              )}
              {error && (
                <Alert role="alert" color="danger">
                  {error}
                </Alert>
              )}
            </Stack>
          </AccordionDetails>
        </Accordion>
      </AccordionGroup>
    </Sheet>
  );
}
