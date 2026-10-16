import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormLabel,
  Input,
  Option,
  Select,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import {
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  Search,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { CustomerAnalysisBlock } from "@/components/bloom/blocks/CustomerAnalysisBlock";
import { LoyaltyProgrammeWorkspace } from "./LoyaltyProgrammeWorkspace";
import { IdealCustomerTypeExportPanel } from "./IdealCustomerTypeExportPanel";
import {
  compareCustomerGrowth,
  type GrowthOrder,
} from "../../../../supabase/functions/_shared/customer-intelligence/customer-growth";
import { readAllPages } from "../../../../supabase/functions/_shared/customer-intelligence/query-pages";
import { defaultGrowthDates } from "@/lib/customer-intelligence/presentation";
import {
  phoenixPeriod,
  type PhoenixPeriodPreset,
} from "@/lib/customer-intelligence/phoenix-periods";
import {
  bloomIntelligenceUrl,
  growthExplainerQuestion,
  productExplorationQuestion,
  type IntelligenceView,
} from "@/lib/customer-intelligence/intelligenceExperience";

type WorkspaceSection = "all" | "explore" | "growth";
type GrowthReport = ReturnType<typeof compareCustomerGrowth>;

export function CustomerGrowthWorkspace({
  section = "all",
}: {
  section?: WorkspaceSection;
}) {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const timezone =
    typeof tenant?.settings?.timezone === "string"
      ? tenant.settings.timezone
      : "America/Vancouver";
  const [dates, setDates] = React.useState(() =>
    defaultGrowthDates(new Date(), timezone),
  );
  const [preset, setPreset] = React.useState<PhoenixPeriodPreset>("mtd");
  const [currency, setCurrency] = React.useState("CAD");
  const [spend, setSpend] = React.useState(50);
  const [visits, setVisits] = React.useState(50);
  const [perDay, setPerDay] = React.useState(false);
  const [product, setProduct] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [report, setReport] = React.useState<GrowthReport | null>(null);
  const [page, setPage] = React.useState(1);
  const request = React.useRef(0);
  const showExplore = section !== "growth";
  const showGrowth = section !== "explore";
  const view: IntelligenceView = section === "growth" ? "growth" : "explore";

  React.useEffect(() => {
    request.current++;
    setReport(null);
    setError("");
    setBusy(false);
    setPreset("mtd");
    setPerDay(false);
    setPage(1);
    setDates(defaultGrowthDates(new Date(), timezone));
  }, [tenant?.id, timezone]);

  React.useEffect(() => {
    // The displayed evidence always corresponds to the exact controls used to calculate it.
    request.current++;
    setReport(null);
    setPage(1);
    setError("");
    setBusy(false);
  }, [dates, currency, spend, visits, perDay]);

  const selectedPeriod = React.useMemo(() => {
    try {
      return phoenixPeriod("custom", new Date(), timezone, dates);
    } catch {
      return null;
    }
  }, [dates, timezone]);

  const ask = (prompt: string) => navigate(bloomIntelligenceUrl(prompt, view));

  function choosePeriod(next: PhoenixPeriodPreset) {
    setPreset(next);
    setPerDay(false);
    if (next !== "custom") {
      const period = phoenixPeriod(next, new Date(), timezone);
      setDates({
        current_start: period.current_start,
        current_end: period.current_end,
        baseline_start: period.baseline_start,
        baseline_end: period.baseline_end,
      });
    }
  }

  const compare = async () => {
    if (!tenant?.id || busy) return;
    const token = ++request.current;
    const tenantId = tenant.id;
    const cutoff = new Date().toISOString();
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const [customers, orders] = await Promise.all([
        readAllPages<{ id: string }>((from, to) =>
          supabase
            .from("crm_customers")
            .select("id")
            .eq("tenant_id", tenantId)
            .is("deleted_at", null)
            .is("merged_into_customer_id", null)
            .lte("created_at", cutoff)
            .order("id")
            .range(from, to),
        ),
        readAllPages<GrowthOrder>((from, to) =>
          supabase
            .from("pos_orders")
            .select(
              "id,tenant_id,crm_customer_id,order_date,created_at,total_amount,refund_amount,currency,status",
            )
            .eq("tenant_id", tenantId)
            .lte("created_at", cutoff)
            .order("id")
            .range(from, to),
        ),
      ]);
      const result = compareCustomerGrowth(
        orders,
        customers.map((c) => c.id),
        tenantId,
        {
          ...dates,
          currency,
          timezone,
          data_cutoff: cutoff,
          spend_weight: spend,
          visits_weight: visits,
          per_day_rates: perDay,
        },
      );
      if (token === request.current) {
        setReport(result);
        setPage(1);
      }
    } catch (e) {
      if (token === request.current)
        setError(
          e instanceof Error
            ? e.message
            : "Unable to compare purchase history.",
        );
    } finally {
      if (token === request.current) setBusy(false);
    }
  };

  return (
    <Stack spacing={2.25}>
      {showExplore && (
        <Sheet
          variant="outlined"
          sx={{ p: { xs: 2.25, md: 3 }, borderRadius: "20px" }}
        >
          <Stack spacing={1.75}>
            <Stack direction="row" alignItems="center" gap={1.2}>
              <Sheet
                variant="soft"
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "lg",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Search size={19} />
              </Sheet>
              <Stack spacing={0.15}>
                <Typography level="title-lg">
                  Start with something a customer bought
                </Typography>
                <Typography level="body-sm" color="neutral">
                  Keep refining the same exact group with Bloom.
                </Typography>
              </Stack>
            </Stack>
            <Box
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                try {
                  ask(productExplorationQuestion(product));
                  setError("");
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Enter a product name.",
                  );
                }
              }}
            >
              <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
                <Input
                  aria-label="Product to explore"
                  placeholder="For example: hydrangeas, fertilizer, patio pottery…"
                  value={product}
                  onChange={(event) => {
                    setProduct(event.target.value);
                    setError("");
                  }}
                  sx={{ flex: 1, borderRadius: "lg" }}
                  slotProps={{ input: { maxLength: 180 } }}
                />
                <Button
                  type="submit"
                  disabled={!product.trim()}
                  startDecorator={<Sparkles size={15} />}
                  sx={{ borderRadius: "lg" }}
                >
                  Find buyers with Bloom <ArrowRight size={14} />
                </Button>
              </Stack>
            </Box>
            {error && section === "explore" && (
              <Typography role="alert" level="body-sm" color="danger">
                {error}
              </Typography>
            )}
            <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
              <Typography level="body-xs" color="neutral">
                Next, ask:
              </Typography>
              {[
                "Which of those bought fertilizer?",
                "Who did not come back?",
                "Save the exact people as a segment",
              ].map((label) => (
                <Button
                  key={label}
                  size="sm"
                  variant="plain"
                  color="neutral"
                  onClick={() =>
                    ask(
                      "Continue an existing customer purchase exploration with the follow-up question: " +
                        JSON.stringify(label) +
                        ". If there is no saved working customer set in this Bloom conversation, ask me which set to use. Never infer the previous group.",
                    )
                  }
                >
                  {label}
                </Button>
              ))}
            </Stack>
            <Divider />
            <Typography level="body-xs" color="neutral">
              Bloom opens with the question ready for review. It shows included,
              excluded and unknown customers and can save the reviewed group
              without sending a message.
            </Typography>
          </Stack>
        </Sheet>
      )}

      {showGrowth && (
        <Sheet
          variant="outlined"
          sx={{ p: { xs: 2.25, md: 3 }, borderRadius: "20px" }}
        >
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              gap={1}
              alignItems={{ md: "center" }}
              justifyContent="space-between"
            >
              <Stack spacing={0.4}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <ChartNoAxesCombined size={20} />
                  <Typography level="title-lg">
                    Customer Growth Index
                  </Typography>
                </Stack>
                <Typography level="body-sm" color="neutral">
                  Compare spending and recorded visits. An index of 100
                  represents no change.
                </Typography>
              </Stack>
              <Sheet
                variant="soft"
                sx={{
                  px: 1.5,
                  py: 0.8,
                  borderRadius: "lg",
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                }}
              >
                <ShieldCheck size={15} />
                <Typography level="body-xs" sx={{ fontWeight: 700 }}>
                  Unknown history is never scored as zero
                </Typography>
              </Sheet>
            </Stack>
            <FormControl sx={{ maxWidth: 480 }}>
              <FormLabel>Compare which period?</FormLabel>
              <Select
                value={preset}
                onChange={(_, value) => {
                  if (value) choosePeriod(value as PhoenixPeriodPreset);
                }}
              >
                <Option value="mtd">
                  Month to date · same dates last year
                </Option>
                <Option value="ytd">Year to date · same dates last year</Option>
                <Option value="previous_month">
                  Last completed month · last year
                </Option>
                <Option value="previous_year">
                  Last completed year · prior year
                </Option>
                <Option value="custom">Custom dates</Option>
              </Select>
            </FormControl>
            <Sheet variant="soft" sx={{ p: 2, borderRadius: "lg" }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ sm: "center" }}
                gap={1.5}
              >
                <CalendarDays size={20} />
                <Stack sx={{ flex: 1 }}>
                  <Typography level="title-sm">
                    {dates.baseline_start} – {dates.baseline_end}
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    compared with {dates.current_start} – {dates.current_end}
                  </Typography>
                </Stack>
                <Typography level="body-xs" color="neutral">
                  {currency} · {spend}% spend · {visits}% visits
                </Typography>
              </Stack>
            </Sheet>
            <Box
              component="details"
              sx={{
                borderRadius: "lg",
                border: "1px solid",
                borderColor: "neutral.outlinedBorder",
                p: 2,
              }}
            >
              <Typography
                component="summary"
                level="title-sm"
                sx={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <SlidersHorizontal size={17} /> Adjust dates, currency & weights
              </Typography>
              <Stack spacing={2} sx={{ mt: 2 }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)" },
                    gap: 1.25,
                  }}
                >
                  {(
                    [
                      ["baseline_start", "Previous period starts"],
                      ["baseline_end", "Previous period ends"],
                      ["current_start", "Current period starts"],
                      ["current_end", "Current period ends"],
                    ] as const
                  ).map(([key, label]) => (
                    <FormControl key={key}>
                      <FormLabel>{label}</FormLabel>
                      <Input
                        type="date"
                        value={dates[key]}
                        onChange={(event) => {
                          setPreset("custom");
                          setDates((d) => ({
                            ...d,
                            [key]: event.target.value,
                          }));
                        }}
                      />
                    </FormControl>
                  ))}
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(3,1fr)" },
                    gap: 1.25,
                  }}
                >
                  <FormControl>
                    <FormLabel>Spending weight (%)</FormLabel>
                    <Input
                      type="number"
                      slotProps={{ input: { min: 0, max: 100 } }}
                      value={spend}
                      onChange={(event) => setSpend(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Visit weight (%)</FormLabel>
                    <Input
                      type="number"
                      slotProps={{ input: { min: 0, max: 100 } }}
                      value={visits}
                      onChange={(event) =>
                        setVisits(Number(event.target.value))
                      }
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Currency</FormLabel>
                    <Input
                      value={currency}
                      onChange={(event) =>
                        setCurrency(event.target.value.toUpperCase())
                      }
                      slotProps={{ input: { maxLength: 3 } }}
                    />
                  </FormControl>
                </Box>
                <Checkbox
                  label="Use daily rates instead of total values when periods have different lengths"
                  checked={perDay}
                  onChange={(event) => setPerDay(event.target.checked)}
                />
              </Stack>
            </Box>
            <Typography
              level="body-sm"
              sx={{ color: "text.secondary", lineHeight: 1.6 }}
            >
              {selectedPeriod?.note ??
                "Review the date range; the periods must be valid, separate and not in the future."}
            </Typography>
            {selectedPeriod?.normalizeDailyRequired && !perDay && (
              <Alert color="warning" variant="soft">
                These periods have different numbers of days. Enable daily rates
                under Adjust dates & weights to compare them fairly.
              </Alert>
            )}
            {error && (
              <Alert color="danger" role="alert">
                {error}
              </Alert>
            )}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              gap={1}
              alignItems={{ sm: "center" }}
            >
              <Button
                loading={busy}
                disabled={
                  !tenant?.id ||
                  !selectedPeriod ||
                  (selectedPeriod.normalizeDailyRequired && !perDay)
                }
                onClick={() => void compare()}
                startDecorator={<ChartNoAxesCombined size={17} />}
                sx={{ borderRadius: "lg" }}
              >
                Compare customer growth
              </Button>
              <Button
                variant="plain"
                color="neutral"
                onClick={() =>
                  ask(
                    growthExplainerQuestion({
                      baselineStart: dates.baseline_start,
                      baselineEnd: dates.baseline_end,
                      currentStart: dates.current_start,
                      currentEnd: dates.current_end,
                      currency,
                      spendWeight: spend,
                      visitsWeight: visits,
                      perDayRates: perDay,
                    }),
                  )
                }
              >
                Ask Bloom to explain these dates <Sparkles size={14} />
              </Button>
            </Stack>
            <Typography level="body-xs" color="neutral">
              Uses dated, completed POS orders after recorded refunds. Grouped
              IdealPOS totals are not individual visits. Verify source coverage
              before interpreting growth as a programme result.
            </Typography>
          </Stack>
        </Sheet>
      )}
      {showGrowth && report && (
        <Stack spacing={1.5}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(2,minmax(0,1fr))",
                lg: "repeat(4,minmax(0,1fr))",
              },
              gap: 1.25,
            }}
          >
            {(
              [
                [
                  "Average customer growth",
                  report.summary.mean_customer_growth_percent === null
                    ? "Not scored"
                    : (report.summary.mean_customer_growth_percent > 0
                        ? "+"
                        : "") +
                      report.summary.mean_customer_growth_percent.toFixed(1) +
                      "%",
                  "Only customers with comparable history",
                ],
                [
                  "Comparable customers",
                  String(report.summary.comparable_customers),
                  "Out of " + report.summary.customers + " customers",
                ],
                [
                  "Missing a comparison",
                  String(report.summary.unscored_customers),
                  "No invented zero baselines",
                ],
                [
                  "Recorded retention",
                  report.summary.retention_percent === null
                    ? "Not established"
                    : report.summary.retention_percent.toFixed(1) + "%",
                  "Recorded visits, not campaign attribution",
                ],
              ] as const
            ).map(([title, value, note]) => (
              <Sheet
                variant="outlined"
                key={title}
                sx={{ p: 1.75, borderRadius: "16px" }}
              >
                <Stack spacing={0.5}>
                  <Typography
                    level="body-xs"
                    color="neutral"
                    sx={{ fontWeight: 650 }}
                  >
                    {title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: { xs: "1.25rem", md: "1.7rem" },
                      fontWeight: 790,
                      letterSpacing: "-0.03em",
                      lineHeight: 1.25,
                    }}
                  >
                    {value}
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    {note}
                  </Typography>
                </Stack>
              </Sheet>
            ))}
          </Box>
          <Sheet variant="soft" sx={{ p: 2.25, borderRadius: "lg" }}>
            <Stack spacing={1.1}>
              <Typography level="title-sm">
                How the scored customers are changing
              </Typography>
              {(() => {
                const scored = report.rows.filter(
                  (row) => row.growth_index !== null,
                );
                const growing = scored.filter(
                  (row) => row.growth_index! > 100,
                ).length;
                const stable = scored.filter(
                  (row) => row.growth_index === 100,
                ).length;
                const declining = scored.filter(
                  (row) => row.growth_index! < 100,
                ).length;
                return (
                  <>
                    <Box
                      aria-label="Share of comparable customers showing growth, no change, or decline"
                      role="img"
                      sx={{
                        display: "flex",
                        borderRadius: "999px",
                        height: 11,
                        overflow: "hidden",
                        bgcolor: "neutral.200",
                      }}
                    >
                      {scored.length > 0 && (
                        <>
                          <Box
                            sx={{
                              width: (100 * growing) / scored.length + "%",
                              bgcolor: "#526884",
                            }}
                          />
                          <Box
                            sx={{
                              width: (100 * stable) / scored.length + "%",
                              bgcolor: "#9F9CA9",
                            }}
                          />
                          <Box
                            sx={{
                              width: (100 * declining) / scored.length + "%",
                              bgcolor: "#C6A5AE",
                            }}
                          />
                        </>
                      )}
                    </Box>
                    <Stack direction="row" flexWrap="wrap" gap={2}>
                      {(
                        [
                          ["#526884", "Growing", growing],
                          ["#9F9CA9", "Unchanged", stable],
                          ["#C6A5AE", "Declining", declining],
                        ] as const
                      ).map(([color, label, count]) => (
                        <Stack
                          key={label}
                          direction="row"
                          gap={0.75}
                          alignItems="center"
                        >
                          <Box
                            sx={{
                              width: 9,
                              height: 9,
                              borderRadius: "50%",
                              bgcolor: color,
                            }}
                          />
                          <Typography level="body-xs">
                            {label}: {count}
                          </Typography>
                        </Stack>
                      ))}
                      <Typography level="body-xs" color="neutral">
                        {report.summary.unscored_customers} unscored, not
                        included in the bar
                      </Typography>
                    </Stack>
                  </>
                );
              })()}
            </Stack>
          </Sheet>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
            gap={1}
          >
            <Typography level="h3">Your comparison</Typography>
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              startDecorator={<Sparkles size={15} />}
              onClick={() =>
                ask(
                  growthExplainerQuestion({
                    baselineStart: report.settings.baseline_start,
                    baselineEnd: report.settings.baseline_end,
                    currentStart: report.settings.current_start,
                    currentEnd: report.settings.current_end,
                    currency: report.settings.currency,
                    spendWeight: report.settings.spend_weight,
                    visitsWeight: report.settings.visits_weight,
                    perDayRates: Boolean(report.settings.per_day_rates),
                  }),
                )
              }
            >
              Investigate results with Bloom
            </Button>
          </Stack>
          <CustomerAnalysisBlock
            data={{
              ...report,
              rows: report.rows.slice((page - 1) * 50, page * 50),
              page,
              total_count: report.rows.length,
              has_more: page * 50 < report.rows.length,
            }}
            onAction={ask}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="outlined"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Typography level="body-xs" color="neutral">
              Page {page} of {Math.max(1, Math.ceil(report.rows.length / 50))}
            </Typography>
            <Button
              variant="outlined"
              disabled={page * 50 >= report.rows.length}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </Stack>
        </Stack>
      )}

      {section === "all" && tenant?.id && (
        <>
          <LoyaltyProgrammeWorkspace tenantId={tenant.id} timezone={timezone} />
          <IdealCustomerTypeExportPanel tenantId={tenant.id} />
        </>
      )}
    </Stack>
  );
}
