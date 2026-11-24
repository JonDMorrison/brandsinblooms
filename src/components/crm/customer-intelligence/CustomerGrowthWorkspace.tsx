import * as React from "react";
import { CustomerGrowthDashboard } from "./CustomerGrowthDashboard";
import {ReportedPurchaseWorkspace} from "./ReportedPurchaseWorkspace";
import {ObservedIdealJournalPanel} from "./ObservedIdealJournalPanel";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormLabel,
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
  CircleHelp,
  Repeat,
  Search,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyInput } from "@/components/joy/JoyInput";
import {
  IntelligenceActions,
  IntelligenceCard,
  IntelligenceFieldGrid,
  IntelligenceStatRow,
} from "./IntelligenceLayout";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { CustomerAnalysisBlock } from "@/components/bloom/blocks/CustomerAnalysisBlock";
import { LoyaltyProgrammeWorkspace } from "./LoyaltyProgrammeWorkspace";
import { IdealCustomerTypeExportPanel } from "./IdealCustomerTypeExportPanel";
import { SeasonalAudiencePanel } from "./SeasonalAudiencePanel";
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
type GrowthReport = ReturnType<typeof compareCustomerGrowth> & {
  rows: (ReturnType<typeof compareCustomerGrowth>["rows"][number] & { name: string })[];
};
type GrowthCustomer = { id: string; first_name: string | null; last_name: string | null };

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
        readAllPages<GrowthCustomer>((from, to) =>
          supabase
            .from("crm_customers")
            .select("id,first_name,last_name")
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
        const names = new Map(customers.map((customer) => [
          customer.id,
          [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || "Unnamed customer",
        ]));
        setReport({ ...result, rows: result.rows.map((row) => ({ ...row, name: names.get(row.customer_id) ?? "Unnamed customer" })) });
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
    <Stack spacing={3}>
      {showExplore && (
        <IntelligenceCard
          icon={<Search />}
          title="Start with something a customer bought"
          description="Keep refining the same exact group with Bloom."
          notes="Bloom opens with the question ready for review. It shows included, excluded and unknown customers and can save the reviewed group without sending a message."
        >
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
            <Stack
              direction={{ xs: "column", sm: "row" }}
              gap={1}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <JoyInput
                size="sm"
                aria-label="Product to explore"
                placeholder="For example: hydrangeas, fertilizer, patio pottery…"
                value={product}
                onChange={(event) => {
                  setProduct(event.target.value);
                  setError("");
                }}
                formControlSx={{ flex: 1, minWidth: 0 }}
                slotProps={{ input: { maxLength: 180 } }}
              />
              <IntelligenceActions sx={{ width: "auto" }}>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!product.trim()}
                  startDecorator={<Sparkles size={14} />}
                  endDecorator={<ArrowRight size={14} />}
                >
                  Find buyers with Bloom
                </Button>
              </IntelligenceActions>
            </Stack>
          </Box>
          {error && section === "explore" && (
            <Typography role="alert" level="body-sm" color="danger">
              {error}
            </Typography>
          )}
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            gap={1.5}
          >
            <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} alignItems="center">
              <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                Next, ask:
              </Typography>
              {[
                "Which of those bought fertilizer?",
                "Who did not come back?",
                "Save the exact people as a segment",
              ].map((label) => (
                <JoyChip
                  key={label}
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  slotProps={{ action: { "aria-label": label } }}
                  onClick={() =>
                    ask(
                      "Continue an existing customer purchase exploration with the follow-up question: " +
                        JSON.stringify(label) +
                        ". If there is no saved working customer set in this Bloom conversation, ask me which set to use. Never infer the previous group.",
                    )
                  }
                >
                  {label}
                </JoyChip>
              ))}
            </Stack>
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              onClick={() =>
                ask(
                  "List my saved analytical audiences using inspect_customer_set with list_audiences=true, page 1.",
                )
              }
            >
              Open saved audiences
            </Button>
          </Stack>
          <Divider sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-200)" }} />
          <SeasonalAudiencePanel key={tenant?.id + timezone} timezone={timezone} onExplore={ask} />
        </IntelligenceCard>
      )}

      {showGrowth && <CustomerGrowthDashboard />}
      {showGrowth && <ReportedPurchaseWorkspace />}
      {showGrowth && (
        <IntelligenceCard
          icon={<ChartNoAxesCombined />}
          title="Customer Growth Index"
          description="Compare spending and recorded visits. An index of 100 represents no change."
          headerActions={
            <JoyChip
              size="sm"
              variant="soft"
              color="neutral"
              startDecorator={<ShieldCheck size={13} />}
            >
              Unknown history is never scored as zero
            </JoyChip>
          }
          notes="Uses dated, completed POS orders after recorded refunds. Grouped IdealPOS totals are not individual visits. Verify source coverage before interpreting growth as a programme result."
        >
          <FormControl size="sm" sx={{ width: "100%", maxWidth: 360 }}>
            <FormLabel>Compare which period?</FormLabel>
            <Select
              size="sm"
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
          <Sheet
            variant="soft"
            color="neutral"
            sx={{ p: 3, borderRadius: "lg" }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ sm: "center" }}
              gap={1.5}
            >
              <CalendarDays size={18} />
              <Stack sx={{ flex: 1 }}>
                <Typography level="title-sm">
                  {dates.current_start} – {dates.current_end}
                </Typography>
                <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                  compared with {dates.baseline_start} – {dates.baseline_end}
                </Typography>
              </Stack>
              <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                {currency} · {spend}% spend · {visits}% visits
              </Typography>
            </Stack>
          </Sheet>
          <Box
            component="details"
            sx={{
              borderRadius: "lg",
              border: "1px solid",
              borderColor: "neutral.200",
              p: 3,
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
              <SlidersHorizontal size={16} /> Adjust dates, currency & weights
            </Typography>
            <Stack spacing={3} sx={{ mt: 3 }}>
              <IntelligenceFieldGrid columns={4}>
                {(
                  [
                    ["baseline_start", "Previous period starts"],
                    ["baseline_end", "Previous period ends"],
                    ["current_start", "Current period starts"],
                    ["current_end", "Current period ends"],
                  ] as const
                ).map(([key, label]) => (
                  <JoyInput
                    key={key}
                    size="sm"
                    label={label}
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
                ))}
              </IntelligenceFieldGrid>
              <IntelligenceFieldGrid columns={4}>
                <JoyInput
                  size="sm"
                  label="Spending weight (%)"
                  type="number"
                  slotProps={{ input: { min: 0, max: 100 } }}
                  value={spend}
                  onChange={(event) => setSpend(Number(event.target.value))}
                />
                <JoyInput
                  size="sm"
                  label="Visit weight (%)"
                  type="number"
                  slotProps={{ input: { min: 0, max: 100 } }}
                  value={visits}
                  onChange={(event) => setVisits(Number(event.target.value))}
                />
                <JoyInput
                  size="sm"
                  label="Currency"
                  value={currency}
                  onChange={(event) =>
                    setCurrency(event.target.value.toUpperCase())
                  }
                  slotProps={{ input: { maxLength: 3 } }}
                />
              </IntelligenceFieldGrid>
              <Checkbox
                size="sm"
                label="Use daily rates instead of total values when periods have different lengths"
                checked={perDay}
                onChange={(event) => setPerDay(event.target.checked)}
              />
            </Stack>
          </Box>
          <Typography level="body-sm" sx={{ color: "neutral.600" }}>
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
          <IntelligenceActions>
            <Button
              size="sm"
              variant="plain"
              color="neutral"
              endDecorator={<Sparkles size={14} />}
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
              Ask Bloom to explain these dates
            </Button>
            <Button size="sm" variant="outlined" color="neutral" disabled={!selectedPeriod} onClick={()=>ask(`Compare reported period spending using compare_customer_growth with evidence_basis=reported_period and scope=all_customers, current_start=${dates.current_start}, current_end=${dates.current_end}, baseline_start=${dates.baseline_start}, baseline_end=${dates.baseline_end}, currency=${currency}. Show unavailable coverage as unknown. Do not infer CGI or visits.`)}>Compare reported spending with Bloom</Button>
            <Button
              size="sm"
              loading={busy}
              disabled={
                !tenant?.id ||
                !selectedPeriod ||
                (selectedPeriod.normalizeDailyRequired && !perDay)
              }
              onClick={() => void compare()}
              startDecorator={<ChartNoAxesCombined size={16} />}
            >
              Compare customer growth
            </Button>
          </IntelligenceActions>
        </IntelligenceCard>
      )}
      {showGrowth && tenant?.id && <ObservedIdealJournalPanel key={JSON.stringify([tenant.id,timezone,dates,currency,spend,visits,perDay])} tenantId={tenant.id} settings={{...dates,timezone,currency,spend_weight:spend,visits_weight:visits,per_day_rates:perDay}} />}
      {showGrowth && report && (
        <Stack spacing={3}>
          <IntelligenceStatRow
            items={[
              {
                icon: <TrendingUp />,
                label: "Average customer growth",
                value:
                  report.summary.mean_customer_growth_percent === null
                    ? "Not scored"
                    : (report.summary.mean_customer_growth_percent > 0
                        ? "+"
                        : "") +
                      report.summary.mean_customer_growth_percent.toFixed(1) +
                      "%",
                detail: "Only customers with comparable history",
              },
              {
                icon: <UsersRound />,
                label: "Comparable customers",
                value: String(report.summary.comparable_customers),
                detail: "Out of " + report.summary.customers + " customers",
              },
              {
                icon: <CircleHelp />,
                label: "Missing a comparison",
                value: String(report.summary.unscored_customers),
                detail: "No invented zero baselines",
              },
              {
                icon: <Repeat />,
                label: "Recorded retention",
                value:
                  report.summary.retention_percent === null
                    ? "Not established"
                    : report.summary.retention_percent.toFixed(1) + "%",
                detail: "Recorded visits, not campaign attribution",
              },
            ]}
          />
          <IntelligenceCard title="How the scored customers are changing">
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
                <Stack spacing={1.5}>
                  <Box
                    aria-label="Share of comparable customers showing growth, no change, or decline"
                    role="img"
                    sx={{
                      display: "flex",
                      borderRadius: "999px",
                      height: 10,
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
                    <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                      {report.summary.unscored_customers} unscored, not
                      included in the bar
                    </Typography>
                  </Stack>
                </Stack>
              );
            })()}
          </IntelligenceCard>
          <IntelligenceCard
            title="Your comparison"
            headerActions={
              <Button
                size="sm"
                variant="outlined"
                color="neutral"
                startDecorator={<Sparkles size={14} />}
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
            }
          >
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
            <IntelligenceActions>
              <Button
                size="sm"
                variant="outlined"
                color="neutral"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                Page {page} of {Math.max(1, Math.ceil(report.rows.length / 50))}
              </Typography>
              <Button
                size="sm"
                variant="outlined"
                color="neutral"
                disabled={page * 50 >= report.rows.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </IntelligenceActions>
          </IntelligenceCard>
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
