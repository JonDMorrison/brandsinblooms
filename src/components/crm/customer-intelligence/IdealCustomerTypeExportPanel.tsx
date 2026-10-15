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
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { readAllPages } from "../../../../supabase/functions/_shared/customer-intelligence/query-pages";
import {
  draftIdealCustomerTypeCsv,
  parseIdealCustomerCsv,
  reviewIdealCustomerTypeExport,
  type IdealCustomerRow,
  type IdealExportPreview,
  type IdealIdentityLink,
} from "@/lib/customer-intelligence/idealCustomerTypeExport";

type Segment = { id: string; name: string };
const unique = (values: string[]) => [...new Set(values)];

export function IdealCustomerTypeExportPanel({
  tenantId,
}: {
  tenantId: string;
}) {
  const { role, hasPermission, access } = useUserRole();
  if (
    !["owner_admin", "marketing"].includes(role ?? "") ||
    !hasPermission("loyalty.write") ||
    access.tenantId !== tenantId
  )
    return null;
  return (
    <IdealCustomerTypeExportWorksheet key={tenantId} tenantId={tenantId} />
  );
}

/** Preview is browser-local. No PII from the full Ideal customer file is uploaded or persisted. */
export function IdealCustomerTypeExportWorksheet({
  tenantId,
}: {
  tenantId: string;
}) {
  const [opened, setOpened] = React.useState(false);
  const [segments, setSegments] = React.useState<Segment[]>([]);
  const [segmentId, setSegmentId] = React.useState("");
  const [sourceFileName, setSourceFileName] = React.useState("");
  const [sourceRows, setSourceRows] = React.useState<IdealCustomerRow[]>([]);
  const [newType, setNewType] = React.useState("");
  const [preview, setPreview] = React.useState<IdealExportPreview | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);
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
        if (valid) setSegments(items);
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
  }, [tenantId, opened]);

  async function readSource(file: File) {
    if (!/\.csv$/i.test(file.name) || file.size > 25_000_000) {
      setError(
        "Choose the original nine-column Ideal customer CSV (maximum 25 MB). Do not open and re-save it in Excel.",
      );
      return;
    }
    setError("");
    setBusy(true);
    setPreview(null);
    setConfirmed(false);
    try {
      const rows = parseIdealCustomerCsv(await file.text());
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
  async function review() {
    if (!segmentId || !sourceRows.length || !newType) return;
    setBusy(true);
    setError("");
    setPreview(null);
    setConfirmed(false);
    try {
      const members = await readAllPages<{ customer_id: string }>((from, to) =>
        supabase
          .from("customer_segments")
          .select("customer_id")
          .eq("segment_id", segmentId)
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
        if (!mounted.current) return;
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
      const result = reviewIdealCustomerTypeExport({
        originalRows: sourceRows,
        audienceCustomerIds: ids,
        identityLinks: links,
        newType,
        confirmedExistingTypes: unique(
          sourceRows.map((r) => r.TYPE).filter(Boolean),
        ),
      });
      if (mounted.current) setPreview(result);
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
  function exportReview() {
    if (!confirmed || preview?.state !== "ready_to_review" || !mounted.current)
      return;
    try {
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
      setError(
        e instanceof Error
          ? e.message
          : "Review-only file could not be created.",
      );
    }
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
                <FormLabel>Original Ideal Customer Details CSV</FormLabel>
                <Button variant="outlined" component="label" disabled={busy}>
                  Choose nine-column source file
                  <input
                    hidden
                    type="file"
                    accept=".csv,text/csv"
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
                  {preview.errors.map((msg) => (
                    <Alert key={msg} color="danger">
                      {msg}
                    </Alert>
                  ))}
                  {preview.unknownCustomerCodes.length > 0 && (
                    <Typography level="body-sm">
                      Customer codes missing from the source:{" "}
                      {preview.unknownCustomerCodes.slice(0, 10).join(", ")}
                      {preview.unknownCustomerCodes.length > 10
                        ? ` and ${preview.unknownCustomerCodes.length - 10} more`
                        : ""}
                      .
                    </Typography>
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
                    label="I reviewed the complete audience and TYPE changes, and understand this is not an approved IdealPOS import."
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
                    onClick={exportReview}
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
