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
  Input,
  Option,
  Select,
  Sheet,
  Stack,
  Table,
  Typography,
} from "@mui/joy";
import { CalendarDays, Download, Upload } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { useUserRole } from "@/hooks/useUserRole";
import {
  programmeCommand,
  downloadProgrammeData,
  type CalendarReview,
  type PreviewPage,
} from "@/lib/loyalty/programmeApi";
import {
  openCalendarWorkbook,
  calendarWorkbookRows,
  type WorkbookSource,
} from "@/lib/loyalty/calendarWorkbook";
import type {
  CalendarMapping,
  CalendarImportOptions,
  CalendarPreviewRow,
} from "../../../supabase/functions/_shared/loyalty/calendar-import";

export function MarketingCalendarImport({
  onImported,
}: {
  onImported?: () => void;
}) {
  const { tenant } = useTenant(),
    { role, hasPermission } = useUserRole();
  if (
    !tenant ||
    !["owner_admin", "marketing"].includes(role ?? "") ||
    !hasPermission("loyalty.write")
  )
    return null;
  return (
    <CalendarImportWorksheet
      key={tenant.id}
      tenantId={tenant.id}
      timezone={
        typeof tenant.settings?.timezone === "string"
          ? tenant.settings.timezone
          : "America/Vancouver"
      }
      onImported={onImported}
    />
  );
}
export function CalendarImportWorksheet({
  tenantId,
  timezone,
  onImported,
}: {
  tenantId: string;
  timezone: string;
  onImported?: () => void;
}) {
  const [source, setSource] = React.useState<WorkbookSource | null>(null),
    [sheet, setSheet] = React.useState(""),
    [header, setHeader] = React.useState("1");
  const [name, setName] = React.useState("My marketing calendar"),
    [zone, setZone] = React.useState(timezone),
    [format, setFormat] =
      React.useState<CalendarImportOptions["dateFormat"]>("iso");
  const [channel, setChannel] =
    React.useState<CalendarImportOptions["defaultChannel"]>("email");
  const [headers, setHeaders] = React.useState<string[]>([]),
    [rawRows, setRawRows] = React.useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = React.useState<CalendarMapping>({
    title: "",
    date: "",
    channel: null,
    notes: null,
    theme: null,
  });
  const [review, setReview] = React.useState<CalendarReview | null>(null),
    [rows, setRows] = React.useState<CalendarPreviewRow[]>([]),
    [page, setPage] = React.useState(1);
  const [confirmed, setConfirmed] = React.useState(false),
    [acceptRejected, setAcceptRejected] = React.useState(false),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(""),
    [notice, setNotice] = React.useState("");
  const [history, setHistory] = React.useState<
    {
      id: string;
      name: string;
      created_at: string;
      preview_id: string;
      result: { created: number; duplicates: number; rejected: number };
    }[]
  >([]);
  const active = React.useRef(true);
  React.useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  React.useEffect(() => {
    setReview(null);
    setRows([]);
    setConfirmed(false);
    setAcceptRejected(false);
  }, [rawRows, mapping, name, zone, format, channel]);
  async function perform(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      if (active.current)
        setError(e instanceof Error ? e.message : "Calendar import failed.");
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function open(file: File) {
    await perform(async () => {
      const workbook = await openCalendarWorkbook(file);
      if (active.current) {
        setSource(workbook);
        setSheet(workbook.sheets[0]);
        setHeaders([]);
        setRawRows([]);
        setMapping({
          title: "",
          date: "",
          channel: null,
          notes: null,
          theme: null,
        });
        setReview(null);
      }
    });
  }
  async function readRows() {
    if (!source) return;
    await perform(async () => {
      const parsed = await calendarWorkbookRows(source, sheet, Number(header));
      if (active.current) {
        setHeaders(parsed.headers);
        setRawRows(parsed.rows);
        setMapping({
          title: "",
          date: "",
          channel: null,
          notes: null,
          theme: null,
        });
      }
    });
  }
  async function preview() {
    await perform(async () => {
      const result = await programmeCommand<CalendarReview>(tenantId, {
        action: "calendar_preview",
        rows: rawRows,
        mapping,
        options: {
          name,
          timezone: zone,
          dateFormat: format,
          defaultChannel: channel,
          headerRow: Number(header),
          sourceFilename: source?.name ?? "",
        },
      });
      if (active.current) {
        setReview(result);
        setRows(result.preview.rows);
        setPage(1);
        setConfirmed(false);
        setAcceptRejected(false);
      }
    });
  }
  async function refreshHistory() {
    const data = await programmeCommand<{ batches: typeof history }>(tenantId, {
      action: "calendar_history",
      page: 1,
    });
    if (active.current) setHistory(data.batches);
  }
  async function commit() {
    if (!review || !confirmed) return;
    await perform(async () => {
      const result = await programmeCommand<{
        saved: {
          created: number;
          duplicates: number;
          rejected: number;
          scheduledMessages: number;
        };
      }>(tenantId, {
        action: "calendar_confirm",
        previewId: review.previewId,
        digest: review.digest,
        confirmed: true,
        acceptRejected,
      });
      if (active.current) {
        setNotice(
          `${result.saved.created} planned tasks imported. ${result.saved.duplicates} duplicates and ${result.saved.rejected} rejected rows remain accounted for. No messages scheduled.`,
        );
        setConfirmed(false);
        setReview(null);
        await refreshHistory();
        onImported?.();
      }
    });
  }
  async function downloadReview(previewId: string) {
    await perform(async () => {
      const originalRows: unknown[] = [];
      let next = 1;
      let total = 1;
      while (originalRows.length < total) {
        if (!active.current) return;
        const data = await programmeCommand<PreviewPage<CalendarPreviewRow>>(
          tenantId,
          { action: "preview_page", previewId, page: next++ },
        );
        total = data.count;
        if (data.rows.length === 0 && total > originalRows.length)
          throw new Error("Could not retrieve all original rows.");
        originalRows.push(...data.rows);
      }
      if (active.current)
        downloadProgrammeData(
          `calendar-review-${previewId}.json`,
          JSON.stringify({ originalRows }, null, 2),
        );
    });
  }
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "xl" }}>
      <AccordionGroup>
        <Accordion>
          <AccordionSummary>
            <Stack direction="row" gap={1} alignItems="center">
              <CalendarDays size={20} />
              <Typography level="title-lg">
                Import your marketing calendar
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2} sx={{ py: 1 }}>
              <Typography level="body-md">
                Bring the plan you already use into this calendar. Review column
                mappings, dates, duplicates and rejected rows before anything is
                saved.
              </Typography>
              <Alert variant="soft">
                Imported items remain planned tasks. Importing does not send or
                schedule an email, text or push notification.
              </Alert>
              <Button
                component="label"
                variant="outlined"
                startDecorator={<Upload size={16} />}
                disabled={busy}
              >
                Choose Excel or CSV file
                <Input
                  type="file"
                  sx={{ display: "none" }}
                  slotProps={{
                    input: {
                      accept: ".xlsx,.xls,.csv,.tsv,.txt",
                      "aria-label": "Marketing calendar file",
                    },
                  }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void open(file);
                  }}
                />
              </Button>
              {source && (
                <>
                  <Typography level="body-sm">
                    {source.name}. Workbook date system:{" "}
                    {source.epoch.replace("excel_", "Excel ")}.
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr auto" },
                      gap: 1.5,
                    }}
                  >
                    <FormControl>
                      <FormLabel>Sheet</FormLabel>
                      <Select
                        value={sheet}
                        onChange={(_, value) => {
                          if (value) {
                            setSheet(value);
                            setRawRows([]);
                            setHeaders([]);
                          }
                        }}
                        disabled={busy}
                      >
                        {source.sheets.map((s) => (
                          <Option key={s} value={s}>
                            {s}
                          </Option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Heading row number</FormLabel>
                      <Input
                        type="number"
                        value={header}
                        onChange={(e) => {
                          setHeader(e.target.value);
                          setRawRows([]);
                          setHeaders([]);
                        }}
                        disabled={busy}
                      />
                    </FormControl>
                    <Button
                      variant="outlined"
                      loading={busy}
                      onClick={() => void readRows()}
                    >
                      Read selected sheet
                    </Button>
                  </Box>
                </>
              )}
              {headers.length > 0 && (
                <>
                  <Typography level="title-md">
                    Map {rawRows.length} source rows
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                      gap: 1.5,
                    }}
                  >
                    {(
                      ["title", "date", "channel", "notes", "theme"] as const
                    ).map((field) => (
                      <FormControl key={field}>
                        <FormLabel>
                          {field === "title"
                            ? "Title column (required)"
                            : field === "date"
                              ? "Date column (required)"
                              : `${field[0].toUpperCase()}${field.slice(1)} column`}
                        </FormLabel>
                        <Select
                          value={mapping[field] || null}
                          placeholder="Choose a source column"
                          onChange={(_, value) =>
                            setMapping((m) => ({
                              ...m,
                              [field]:
                                value ??
                                (field === "title" || field === "date"
                                  ? ""
                                  : null),
                            }))
                          }
                          disabled={busy}
                        >
                          {!["title", "date"].includes(field) && (
                            <Option value="">Not mapped</Option>
                          )}
                          {headers.map((h) => (
                            <Option key={h} value={h}>
                              {h}
                            </Option>
                          ))}
                        </Select>
                      </FormControl>
                    ))}
                  </Box>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                      gap: 1.5,
                    }}
                  >
                    <FormControl>
                      <FormLabel>Plan name</FormLabel>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={busy}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Business timezone</FormLabel>
                      <Input
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}
                        disabled={busy}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Source date format</FormLabel>
                      <Select
                        value={format}
                        onChange={(_, value) => value && setFormat(value)}
                        disabled={busy}
                      >
                        <Option value="iso">YYYY-MM-DD</Option>
                        <Option value="day_first">Day / month / year</Option>
                        <Option value="month_first">Month / day / year</Option>
                        <Option value="excel_1900">
                          Excel 1900 serial dates
                        </Option>
                        <Option value="excel_1904">
                          Excel 1904 serial dates
                        </Option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>
                        Default channel when no column is mapped
                      </FormLabel>
                      <Select
                        value={channel}
                        onChange={(_, value) => value && setChannel(value)}
                        disabled={busy}
                      >
                        {["email", "newsletter", "sms", "blog"].map((c) => (
                          <Option key={c} value={c}>
                            {c}
                          </Option>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  <Button
                    loading={busy}
                    disabled={!mapping.title || !mapping.date || !name.trim()}
                    onClick={() => void preview()}
                  >
                    Preview import
                  </Button>
                </>
              )}
              {review && (
                <Sheet variant="soft" sx={{ p: 2, borderRadius: "lg" }}>
                  <Stack spacing={1.5}>
                    <Typography level="title-lg">
                      {review.preview.counts.accepted} ready ·{" "}
                      {review.preview.counts.duplicate} duplicates ·{" "}
                      {review.preview.counts.rejected} need attention
                    </Typography>
                    <Box sx={{ overflowX: "auto" }}>
                      <Table
                        size="sm"
                        aria-label="Calendar import preview"
                        sx={{ minWidth: 650 }}
                      >
                        <thead>
                          <tr>
                            <th style={{ width: 65 }}>Row</th>
                            <th>Title and date</th>
                            <th>Status</th>
                            <th>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.rowNumber}>
                              <td>{row.rowNumber}</td>
                              <td>
                                {row.item?.title ??
                                  String(row.original[mapping.title] ?? "")}
                                <br />
                                {row.item?.date ??
                                  String(row.original[mapping.date] ?? "")}
                              </td>
                              <td>{row.state}</td>
                              <td>
                                {row.errors.length
                                  ? row.errors.join(" ")
                                  : row.item?.channel}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Box>
                    <Stack direction="row" gap={1}>
                      {[-1, 1].map((direction) => (
                        <Button
                          key={direction}
                          size="sm"
                          variant="outlined"
                          disabled={
                            busy ||
                            (direction < 0
                              ? page <= 1
                              : page * 50 >= review.preview.counts.source)
                          }
                          onClick={() =>
                            void perform(async () => {
                              const data = await programmeCommand<
                                PreviewPage<CalendarPreviewRow>
                              >(tenantId, {
                                action: "preview_page",
                                previewId: review.previewId,
                                page: page + direction,
                              });
                              if (active.current) {
                                setRows(data.rows);
                                setPage(data.page);
                              }
                            })
                          }
                        >
                          {direction < 0 ? "Previous" : "Next"}
                        </Button>
                      ))}
                      <Typography>Page {page}</Typography>
                      <Button
                        variant="plain"
                        startDecorator={<Download size={14} />}
                        disabled={busy}
                        onClick={() => void downloadReview(review.previewId)}
                      >
                        Original rows and review
                      </Button>
                    </Stack>
                    {review.preview.counts.rejected > 0 && (
                      <Checkbox
                        checked={acceptRejected}
                        onChange={(e) => setAcceptRejected(e.target.checked)}
                        label={`Leave ${review.preview.counts.rejected} rejected rows out of the calendar, keeping them in the saved review.`}
                        disabled={busy}
                      />
                    )}
                    <Checkbox
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      label={`Import ${review.preview.counts.accepted} accepted rows as planned tasks only.`}
                      disabled={busy}
                    />
                    <Button
                      disabled={
                        busy ||
                        !confirmed ||
                        review.preview.counts.accepted === 0 ||
                        (review.preview.counts.rejected > 0 && !acceptRejected)
                      }
                      onClick={() => void commit()}
                    >
                      Confirm calendar import
                    </Button>
                  </Stack>
                </Sheet>
              )}
              {error && (
                <Alert role="alert" color="danger">
                  {error}
                </Alert>
              )}
              {notice && <Alert color="success">{notice}</Alert>}
              <Button
                variant="plain"
                disabled={busy}
                onClick={() => void perform(refreshHistory)}
              >
                View previous calendar imports
              </Button>
              {history.map((batch) => (
                <Stack
                  key={batch.id}
                  direction={{ xs: "column", sm: "row" }}
                  gap={1}
                  justifyContent="space-between"
                >
                  <Typography level="body-sm">
                    {batch.name} · {batch.result.created} tasks ·{" "}
                    {new Date(batch.created_at).toLocaleString()}
                  </Typography>
                  <Button
                    size="sm"
                    variant="outlined"
                    disabled={busy}
                    onClick={() => void downloadReview(batch.preview_id)}
                  >
                    Review original rows
                  </Button>
                </Stack>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      </AccordionGroup>
    </Sheet>
  );
}
