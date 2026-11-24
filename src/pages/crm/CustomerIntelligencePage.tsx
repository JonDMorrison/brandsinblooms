import * as React from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Sheet,
  Skeleton,
  Stack,
  Textarea,
  Typography,
} from "@mui/joy";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  Database,
  Gift,
  Layers3,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoyPageHeaderBand } from "@/components/joy/JoyPageHeaderBand";
import { JoyCard, JoyCardContent } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyTabs,
  JoyTabsList,
  JoyTabsTrigger,
} from "@/components/joy/JoyTabs";
import { ImportedReportsPanel } from "@/components/crm/customer-intelligence/ImportedReportsPanel";
import { CustomerGrowthWorkspace } from "@/components/crm/customer-intelligence/CustomerGrowthWorkspace";
import { LoyaltyProgrammeWorkspace } from "@/components/crm/customer-intelligence/LoyaltyProgrammeWorkspace";
import { IdealCustomerTypeExportPanel } from "@/components/crm/customer-intelligence/IdealCustomerTypeExportPanel";
import { PushPilotPanel } from "@/components/crm/customer-intelligence/PushPilotPanel";
import { PushReadinessPanel } from "@/components/crm/customer-intelligence/PushReadinessPanel";
import { CampaignReadinessPanel } from "@/components/crm/customer-intelligence/CampaignReadinessPanel";
import {
  autosizeSx,
  IntelligenceActions,
  IntelligenceCard,
  IntelligenceNote,
  IntelligenceSectionHeader,
  IntelligenceStatRow,
} from "@/components/crm/customer-intelligence/IntelligenceLayout";
import {
  loadIntelligenceHome,
  type IntelligenceRow,
} from "@/lib/customer-intelligence/intelligenceHome";
import {
  INTELLIGENCE_QUESTIONS,
  bloomIntelligenceUrl,
  intelligenceView,
  type IntelligenceView,
} from "@/lib/customer-intelligence/intelligenceExperience";

const num = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);
const person = (row: IntelligenceRow) =>
  [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
  row.email ||
  "Customer profile";

const VIEWS: { id: IntelligenceView; title: string }[] = [
  { id: "overview", title: "Overview" },
  { id: "explore", title: "Find customers" },
  { id: "growth", title: "Growth" },
  { id: "rewards", title: "Rewards" },
  { id: "data", title: "Data & channels" },
];

const SECTION_CONTEXT: Record<
  IntelligenceView,
  { caption: string; question: string; examples: string[] }
> = {
  overview: {
    caption: "Your customer intelligence companion",
    question: INTELLIGENCE_QUESTIONS.opportunities,
    examples: [
      "Where should I focus?",
      "Which customers are slowing down?",
      "What have customers been buying?",
    ],
  },
  explore: {
    caption: "Explore an exact audience with Bloom",
    question: INTELLIGENCE_QUESTIONS.discover,
    examples: [
      "Find buyers of a particular product",
      "Compare two buying groups",
      "Help me save a segment",
    ],
  },
  growth: {
    caption: "Understand the movement behind the numbers",
    question: INTELLIGENCE_QUESTIONS.slower,
    examples: [
      "Who is growing year over year?",
      "Which records lack a baseline?",
      "Explain seasonal inactivity",
    ],
  },
  rewards: {
    caption: "Turn customer knowledge into a thoughtful benefit",
    question: INTELLIGENCE_QUESTIONS.rewards,
    examples: [
      "Plan a second-visit offer",
      "Create a win-back draft",
      "Measure the result",
    ],
  },
  data: {
    caption: "Make the evidence dependable",
    question: INTELLIGENCE_QUESTIONS.sources,
    examples: [
      "What can Ideal reports prove?",
      "Which records need review?",
      "Explain missing transactions",
    ],
  },
};

const SECTION_SUGGESTIONS: Record<
  Exclude<IntelligenceView, "overview">,
  { text: string; query: string }[]
> = {
  explore: [
    { text: "Build an audience", query: INTELLIGENCE_QUESTIONS.discover },
  ],
  growth: [
    { text: "Understand inactivity", query: INTELLIGENCE_QUESTIONS.gaps },
  ],
  rewards: [{ text: "Plan a win-back", query: INTELLIGENCE_QUESTIONS.rewards }],
  data: [
    { text: "Check source quality", query: INTELLIGENCE_QUESTIONS.sources },
  ],
};

function SuggestionChip({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <JoyChip
      size="sm"
      variant="outlined"
      color="neutral"
      startDecorator={icon}
      onClick={onClick}
      slotProps={{ action: { "aria-label": label } }}
    >
      {label}
    </JoyChip>
  );
}

function BloomCompanion({
  view,
  onAsk,
  inputRef,
}: {
  view: IntelligenceView;
  onAsk: (question: string) => void;
  inputRef: React.Ref<HTMLDivElement>;
}) {
  const [question, setQuestion] = React.useState("");
  const [error, setError] = React.useState("");
  const context = SECTION_CONTEXT[view];
  React.useEffect(() => {
    setError("");
  }, [view]);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) {
      setError("Write a question or select one of the suggestions.");
      return;
    }
    try {
      onAsk(question);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Bloom could not open this question.",
      );
    }
  }
  const suggestions =
    view === "overview"
      ? [
          {
            text: "Customers buying less",
            query: INTELLIGENCE_QUESTIONS.slower,
          },
          {
            text: "What customers care about",
            query: INTELLIGENCE_QUESTIONS.categories,
          },
        ]
      : SECTION_SUGGESTIONS[view];
  return (
    <IntelligenceCard
      icon={<Sparkles />}
      title="Ask Bloom"
      description={context.caption}
      headerActions={
        <JoyChip size="sm" variant="soft" color="neutral">
          Uses recorded evidence
        </JoyChip>
      }
    >
      <Box component="form" onSubmit={submit} ref={inputRef}>
        <Stack spacing={1.5}>
          <Textarea
            aria-label="Ask Bloom about your customers"
            minRows={3}
            maxRows={8}
            value={question}
            slotProps={{ textarea: { maxLength: 1400 } }}
            placeholder="What would you like to understand about your customers?"
            onChange={(event) => {
              setQuestion(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (question.trim()) onAsk(question);
                else
                  setError(
                    "Write a question or select one of the suggestions.",
                  );
              }
            }}
            sx={{
              bgcolor: "background.surface",
              borderRadius: "12px",
              borderColor: "neutral.200",
              fontSize: "sm",
              "--Textarea-focusedThickness": "1px",
              ...autosizeSx,
            }}
          />
          {error && (
            <Typography role="alert" level="body-sm" color="danger">
              {error}
            </Typography>
          )}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            gap={1.5}
          >
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              Opens Bloom with your question ready to review. Nothing is sent
              automatically.
            </Typography>
            <IntelligenceActions sx={{ width: { xs: "100%", sm: "auto" } }}>
              <Button
                type="submit"
                size="sm"
                startDecorator={<Sparkles size={14} />}
                endDecorator={<ArrowRight size={14} />}
              >
                Continue in Bloom
              </Button>
            </IntelligenceActions>
          </Stack>
        </Stack>
      </Box>
      <Stack spacing={1}>
        <Typography level="body-xs" sx={{ fontWeight: 600, color: "neutral.500" }}>
          Not sure where to start?
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75}>
          <SuggestionChip
            icon={<Sparkles size={12} />}
            label={
              view === "overview"
                ? "Find my best opportunities"
                : "Guide me through this"
            }
            onClick={() => onAsk(context.question)}
          />
          {suggestions.map((item) => (
            <SuggestionChip
              key={item.text}
              label={item.text}
              onClick={() => onAsk(item.query)}
            />
          ))}
        </Stack>
      </Stack>
    </IntelligenceCard>
  );
}

function TaskCard({
  step,
  title,
  description,
  icon: Icon,
  onClick,
  action,
}: {
  step: string;
  title: string;
  description: string;
  icon: typeof Search;
  onClick: () => void;
  action: string;
}) {
  return (
    <JoyCard
      interactive
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <JoyCardContent sx={{ py: 4, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Sheet
            variant="soft"
            color="primary"
            sx={{
              width: 36,
              height: 36,
              borderRadius: "999px",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon size={18} strokeWidth={1.8} />
          </Sheet>
          <JoyChip size="sm" variant="soft" color="neutral">
            {step}
          </JoyChip>
        </Stack>
        <Stack spacing={0.5}>
          <Typography level="title-md">{title}</Typography>
          <Typography level="body-sm" sx={{ color: "neutral.600" }}>
            {description}
          </Typography>
        </Stack>
        <Typography
          level="body-sm"
          sx={{ fontWeight: 600, color: "primary.600", mt: "auto" }}
        >
          {action} <ArrowRight size={14} style={{ verticalAlign: "middle" }} />
        </Typography>
      </JoyCardContent>
    </JoyCard>
  );
}

function OverviewInsights({
  rows,
  loading,
  error,
  refreshedAt,
  onRetry,
  onAsk,
  onView,
  onCustomer,
}: {
  rows: IntelligenceRow[];
  loading: boolean;
  error: Error | null;
  refreshedAt: number;
  onRetry: () => void;
  onAsk: (prompt: string) => void;
  onView: (view: IntelligenceView) => void;
  onCustomer: (id: string) => void;
}) {
  const withHistory = rows.filter(
    (r) => num(r.lifetime_value) && r.lifetime_value > 0,
  );
  const slowing = rows.filter(
    (r) => num(r.purchase_velocity) && r.purchase_velocity < 0,
  );
  const longGaps = rows.filter(
    (r) => num(r.days_since_last_purchase) && r.days_since_last_purchase >= 120,
  );
  const missingHistory = rows.length - withHistory.length;
  const categories = new Map<string, number>();
  for (const row of rows) {
    for (const category of new Set(
      (row.top_product_categories || []).filter(Boolean),
    )) {
      categories.set(category, (categories.get(category) || 0) + 1);
    }
  }
  const topCategories = [...categories.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5);

  return (
    <Stack spacing={3}>
      <IntelligenceSectionHeader
        title="A snapshot of your customer records"
        description="Useful starting signals, not automatic lifecycle labels or a prediction of lost sales."
        action={
          refreshedAt > 0 && !error ? (
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              Last loaded{" "}
              {new Date(refreshedAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </Typography>
          ) : undefined
        }
      />
      {loading && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0,1fr)",
              md: "repeat(2,minmax(0,1fr))",
              lg: "repeat(4,minmax(0,1fr))",
            },
            gap: 3,
          }}
        >
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              sx={{ height: 120, borderRadius: "var(--joy-radius-2xl)" }}
            />
          ))}
        </Box>
      )}
      {!loading && error && (
        <Alert
          variant="soft"
          color="danger"
          role="alert"
          endDecorator={
            <Button
              variant="outlined"
              color="neutral"
              size="sm"
              startDecorator={<RefreshCw size={14} />}
              onClick={onRetry}
            >
              Retry
            </Button>
          }
        >
          We couldn't load the customer overview. No numbers have been
          substituted. Your other Intelligence tools are still available.
        </Alert>
      )}
      {!loading && !error && rows.length === 0 && (
        <IntelligenceCard
          title="Your customer story starts with a source."
          description="There are no accessible customer-intelligence records to summarize yet. Connect a source or review your existing imports first."
          headerActions={
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              endDecorator={<ArrowRight size={14} />}
              onClick={() => onView("data")}
            >
              Review data & connections
            </Button>
          }
        />
      )}
      {!loading && !error && rows.length > 0 && (
        <>
          <IntelligenceStatRow
            items={[
              {
                icon: <UsersRound />,
                label: "Profiles with lifetime spending",
                value: rows.some((r) => num(r.lifetime_value))
                  ? withHistory.length.toLocaleString()
                  : "Not measured",
                detail:
                  "Out of " +
                  rows.length.toLocaleString() +
                  " accessible customer records",
              },
              {
                icon: <Activity />,
                label: "Negative momentum signals",
                value: rows.some((r) => num(r.purchase_velocity))
                  ? slowing.length.toLocaleString()
                  : "Not measured",
                detail:
                  "Recorded purchase-velocity signals; verify seasons before targeting",
              },
              {
                icon: <CalendarDays />,
                label: "120+ day purchase gaps",
                value: rows.some((r) => num(r.days_since_last_purchase))
                  ? longGaps.length.toLocaleString()
                  : "Not measured",
                detail:
                  "A review prompt, not proof that these customers are lapsed",
              },
              {
                icon: <Layers3 />,
                label: "Product affinities",
                value: rows.some((r) => Array.isArray(r.top_product_categories))
                  ? categories.size.toLocaleString()
                  : "Not measured",
                detail:
                  "Distinct categories appearing in the available customer data",
              },
            ]}
          />
          <IntelligenceNote>
            {missingHistory} records do not show a positive lifetime spending value. Imported period reports may still contain useful purchase history. Missing data and zero purchases are not the same. Bloom
            can help check the underlying evidence.
          </IntelligenceNote>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0,1fr)",
                lg: "minmax(0,1.22fr) minmax(0,0.78fr)",
              },
              gap: 3,
            }}
          >
            <IntelligenceCard
              title="Opportunities worth your attention"
              description="Start with evidence. Decide on a campaign later."
              headerActions={
                <IconButton
                  size="sm"
                  variant="plain"
                  color="neutral"
                  aria-label="Explore customer opportunities with Bloom"
                  onClick={() => onAsk(INTELLIGENCE_QUESTIONS.opportunities)}
                >
                  <Sparkles size={18} />
                </IconButton>
              }
            >
              {[
                {
                  icon: Activity,
                  title: "Purchase momentum is changing",
                  count: slowing.length,
                  details:
                    "These customers have a negative recorded purchase-velocity signal. Compare seasons and source coverage before classifying them.",
                  prompt: INTELLIGENCE_QUESTIONS.slower,
                },
                {
                  icon: CalendarDays,
                  title: "Some customers haven't visited recently",
                  count: longGaps.length,
                  details:
                    "120+ days since a last recorded purchase is a starting filter, not a lapsed customer definition.",
                  prompt: INTELLIGENCE_QUESTIONS.gaps,
                },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <Stack
                    key={item.title}
                    direction="row"
                    gap={2}
                    alignItems="flex-start"
                    sx={{
                      pt: i ? 3 : 0,
                      borderTop: i ? "1px solid" : 0,
                      borderColor: "neutral.200",
                    }}
                  >
                    <Sheet
                      variant="soft"
                      color="neutral"
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: "999px",
                        flexShrink: 0,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <Icon size={16} />
                    </Sheet>
                    <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
                      <Typography level="title-sm">{item.title}</Typography>
                      <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                        {item.details}
                      </Typography>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        flexWrap="wrap"
                        gap={1}
                      >
                        <JoyChip variant="soft" color="neutral" size="sm">
                          {item.count.toLocaleString()} observed
                        </JoyChip>
                        <Button
                          size="sm"
                          variant="plain"
                          endDecorator={<ArrowRight size={14} />}
                          onClick={() => onAsk(item.prompt)}
                        >
                          Examine with Bloom
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>
                );
              })}
            </IntelligenceCard>
            <IntelligenceCard
              title="What customers are buying"
              description="Recorded category affinities"
              icon={<Layers3 />}
            >
              <Stack spacing={1.5}>
                {topCategories.length ? (
                  topCategories.map(([category, count], index) => (
                    <Stack
                      key={category}
                      direction="row"
                      alignItems="center"
                      gap={1.5}
                    >
                      <JoyChip size="sm" variant="soft" color="neutral">
                        {String(index + 1).padStart(2, "0")}
                      </JoyChip>
                      <Typography
                        level="body-sm"
                        sx={{ flex: 1, fontWeight: 600, minWidth: 0 }}
                      >
                        {category}
                      </Typography>
                      <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                        {count} profiles
                      </Typography>
                    </Stack>
                  ))
                ) : (
                  <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                    Category history is not available for these profiles.
                  </Typography>
                )}
              </Stack>
              <IntelligenceActions justifyContent="flex-start">
                <Button
                  variant="plain"
                  size="sm"
                  endDecorator={<ArrowRight size={14} />}
                  onClick={() => onAsk(INTELLIGENCE_QUESTIONS.categories)}
                >
                  Explore products with Bloom
                </Button>
              </IntelligenceActions>
            </IntelligenceCard>
          </Box>
          {slowing.length > 0 && (
            <IntelligenceCard
              title="Customers to explore"
              description="A small sample of records with reported slowing momentum."
              headerActions={
                <JoyChip size="sm" color="neutral" variant="soft">
                  Sample · not a saved segment
                </JoyChip>
              }
              notes="Explore and verify the customer history before saving an audience. Missing purchase dates or seasonal buying can change the interpretation."
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0,1fr)",
                    md: "repeat(3,minmax(0,1fr))",
                  },
                  gap: 2,
                }}
              >
                {slowing
                  .slice()
                  .sort(
                    (a, b) =>
                      Number(b.lifetime_value || 0) -
                      Number(a.lifetime_value || 0),
                  )
                  .slice(0, 3)
                  .map((row) => (
                    <Button
                      key={row.customer_id}
                      variant="outlined"
                      color="neutral"
                      onClick={() => onCustomer(row.customer_id)}
                      sx={{
                        bgcolor: "background.surface",
                        borderColor: "neutral.200",
                        p: 2,
                        borderRadius: "lg",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        textAlign: "left",
                        gap: 0.5,
                      }}
                    >
                      <Typography level="title-sm">{person(row)}</Typography>
                      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                        {num(row.purchase_velocity)
                          ? "Recorded momentum " +
                            row.purchase_velocity.toFixed(1)
                          : "Momentum history requires review"}
                      </Typography>
                      <Typography
                        level="body-xs"
                        sx={{ color: "primary.600", fontWeight: 600, mt: 0.5 }}
                      >
                        Open purchase history <ArrowRight size={12} />
                      </Typography>
                    </Button>
                  ))}
              </Box>
            </IntelligenceCard>
          )}
        </>
      )}
    </Stack>
  );
}

function TabPanelBox({
  view,
  active,
  children,
}: {
  view: IntelligenceView;
  active: IntelligenceView;
  children: React.ReactNode;
}) {
  return (
    <Box
      role="tabpanel"
      id={"intelligence-panel-" + view}
      aria-labelledby={"intelligence-tab-" + view}
      hidden={active !== view}
      sx={{ display: active === view ? "block" : "none" }}
    >
      <Stack spacing={3}>{children}</Stack>
    </Box>
  );
}

export default function CustomerIntelligencePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const timezone =
    typeof tenant?.settings?.timezone === "string"
      ? tenant.settings.timezone
      : "America/Vancouver";
  const programme = params.get("programme");
  const active =
    programme && !params.get("view")
      ? "rewards"
      : intelligenceView(params.get("view"));
  const [visited, setVisited] = React.useState<IntelligenceView[]>([active]);
  const [advanced, setAdvanced] = React.useState(false);
  const askBox = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    setVisited((existing) =>
      existing.includes(active) ? existing : [...existing, active],
    );
  }, [active]);
  const scopedTenant = React.useRef(tenantId);
  React.useEffect(() => {
    if (scopedTenant.current === tenantId) return;
    scopedTenant.current = tenantId;
    setVisited([active]);
    setAdvanced(false);
    // A tenant change remounts the tenant-keyed workspaces below.
  }, [tenantId, active]);

  const query = useQuery({
    queryKey: ["customer-intelligence-home", tenantId],
    enabled: Boolean(tenantId) && visited.includes("overview"),
    staleTime: 120000,
    queryFn: () => loadIntelligenceHome(tenantId!),
  });

  const changeView = (view: IntelligenceView) => {
    const next = new URLSearchParams(params);
    next.set("view", view);
    if (view !== "rewards") next.delete("programme");
    setParams(next, { replace: false });
  };
  const askBloom = (question: string) =>
    navigate(bloomIntelligenceUrl(question, active));
  const focusAskBloom = () => {
    const input = askBox.current?.querySelector("textarea");
    if (!input) return;
    input.scrollIntoView?.({ behavior: "smooth", block: "center" });
    input.focus({ preventScroll: true });
  };

  return (
    <PageContainer>
      <Stack spacing={3} sx={{ pb: 4 }}>
        <JoyPageHeaderBand
          title="Customer Intelligence"
          description="Find the right customers, see how their shopping changes, and plan reasons to return."
          metadata={
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              Evidence before recommendations · No automatic messages or offers
            </Typography>
          }
          actions={
            <Stack direction="row">
              <Button
                size="sm"
                startDecorator={<Sparkles size={16} />}
                onClick={focusAskBloom}
              >
                Ask Bloom
              </Button>
            </Stack>
          }
          sx={{
            px: 0,
            py: 0,
            borderRadius: 0,
            background: "transparent",
          }}
        />

        <Box component="nav" aria-label="Intelligence sections" sx={{ minWidth: 0 }}>
          <JoyTabs
            value={active}
            onValueChange={(value) => {
              if (typeof value === "string" && value !== active)
                changeView(intelligenceView(value));
            }}
            sx={{ bgcolor: "transparent" }}
          >
            <JoyTabsList
              disableUnderline
              sx={{
                width: "fit-content",
                maxWidth: "100%",
                overflowX: "auto",
                flexWrap: "nowrap",
                scrollbarWidth: "none",
                "&::-webkit-scrollbar": { display: "none" },
              }}
            >
              {VIEWS.map((item) => (
                <JoyTabsTrigger
                  key={item.id}
                  value={item.id}
                  id={"intelligence-tab-" + item.id}
                  aria-controls={"intelligence-panel-" + item.id}
                  sx={{ flex: "none", whiteSpace: "nowrap", fontSize: "sm" }}
                >
                  {item.title}
                </JoyTabsTrigger>
              ))}
            </JoyTabsList>
          </JoyTabs>
        </Box>

        <BloomCompanion view={active} onAsk={askBloom} inputRef={askBox} />

        {visited.includes("overview") && (
          <TabPanelBox view="overview" active={active}>
            <IntelligenceSectionHeader
              title="What would you like to do today?"
              description="Follow a simple flow. Every step connects to the same customer records; nothing gets lost behind another dashboard."
            />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0,1fr)",
                  md: "repeat(3,minmax(0,1fr))",
                },
                gap: 3,
              }}
            >
              <TaskCard
                step="01 · Discover"
                icon={UsersRound}
                title="Find the right customers"
                description="Search purchase history, create an exact group, and understand why each person qualifies."
                action="Find an audience"
                onClick={() => changeView("explore")}
              />
              <TaskCard
                step="02 · Understand"
                icon={ChartNoAxesCombined}
                title="See what is changing"
                description="Compare visits and spending against a meaningful historical period."
                action="Measure growth"
                onClick={() => changeView("growth")}
              />
              <TaskCard
                step="03 · Act & learn"
                icon={Gift}
                title="Give them a reason to return"
                description="Plan a reward, review the exact people, and measure what happens afterward."
                action="Explore rewards"
                onClick={() => changeView("rewards")}
              />
            </Box>
            {tenantId && <ImportedReportsPanel key={tenantId} tenantId={tenantId} />}
            <OverviewInsights
              rows={query.data ?? []}
              loading={query.isPending && query.fetchStatus === "fetching"}
              error={
                query.error instanceof Error
                  ? query.error
                  : query.error
                    ? new Error("Customer intelligence unavailable.")
                    : null
              }
              refreshedAt={query.dataUpdatedAt}
              onRetry={() => {
                void query.refetch();
              }}
              onAsk={askBloom}
              onView={changeView}
              onCustomer={(id) =>
                navigate(
                  "/crm/customers/" +
                    encodeURIComponent(id) +
                    "?tab=purchase",
                )
              }
            />
            <IntelligenceCard
              icon={<Database />}
              title="Are your records ready to trust?"
              description="Keep original POS files, review missing transactions, and check import dates before relying on growth scores or starting outreach."
              headerActions={
                <Button
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  endDecorator={<ArrowRight size={14} />}
                  onClick={() => changeView("data")}
                >
                  Review sources & channels
                </Button>
              }
            />
          </TabPanelBox>
        )}

        {visited.includes("explore") && (
          <TabPanelBox view="explore" active={active}>
            <IntelligenceSectionHeader
              step="Step 1"
              title="Find a group worth understanding"
              description="Ask Bloom a precise question about products or buying patterns, then inspect the matching, excluded, and unknown customers before saving your group."
              action={
                <Button
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  endDecorator={<ArrowUpRight size={14} />}
                  onClick={() => navigate("/crm/segments")}
                >
                  Open audience builder
                </Button>
              }
            />
            <CustomerGrowthWorkspace
              key={String(tenantId) + "-explore"}
              section="explore"
            />
            <IntelligenceCard
              icon={<ShieldCheck />}
              title="Know exactly why someone matches."
              notes="Bloom preserves follow-up customer sets. Check source evidence and missing data, then save a static group or build a dynamic segment. No one is contacted automatically."
            />
          </TabPanelBox>
        )}

        {visited.includes("growth") && (
          <TabPanelBox view="growth" active={active}>
            <IntelligenceSectionHeader
              step="Step 2"
              title="Make sense of changing customer habits"
              description="Compare each customer with their own historical spending and number of visits. Index 100 means no change; customers without a comparable baseline remain unscored."
            />
            <CustomerGrowthWorkspace
              key={String(tenantId) + "-growth"}
              section="growth"
            />
          </TabPanelBox>
        )}

        {visited.includes("rewards") && (
          <TabPanelBox view="rewards" active={active}>
            <IntelligenceSectionHeader
              step="Step 3"
              title="Build relationships, not just points"
              description="Create welcome benefits, win-back offers, and experiences. Set explicit eligibility and budgets, review recipients, and track results without automatically sending anything."
            />
            {tenantId ? (
              <LoyaltyProgrammeWorkspace
                key={tenantId + "-rewards"}
                tenantId={tenantId}
                timezone={timezone}
              />
            ) : (
              <Alert color="neutral">
                Select a company to manage loyalty programmes.
              </Alert>
            )}
            <IntelligenceCard
              icon={<Sparkles />}
              title="Need a little help designing a programme?"
              description="Bloom can propose a budget-conscious campaign using reviewed customer groups."
              headerActions={
                <Button
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  endDecorator={<Sparkles size={14} />}
                  onClick={() => askBloom(INTELLIGENCE_QUESTIONS.rewards)}
                >
                  Plan with Bloom
                </Button>
              }
            />
          </TabPanelBox>
        )}

        {visited.includes("data") && (
          <TabPanelBox view="data" active={active}>
            <IntelligenceSectionHeader
              title="Make sure the information is dependable"
              description="Connect your point of sale, prepare reviewed exports, and see which communication channels are ready. Advanced pilot controls stay out of the everyday workflow."
              action={
                <Button
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  endDecorator={<ArrowUpRight size={14} />}
                  onClick={() => navigate("/crm/pos")}
                >
                  POS integrations
                </Button>
              }
            />
            <IntelligenceCard
              icon={<Database />}
              title="Your POS remains the source of purchase truth."
              description="Grouped reports cannot establish visits. Review identity matches and source coverage before using your customer-growth results."
              headerActions={
                <Button
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  endDecorator={<ArrowRight size={14} />}
                  onClick={() => askBloom(INTELLIGENCE_QUESTIONS.sources)}
                >
                  Ask Bloom about my sources
                </Button>
              }
            />
            {tenantId ? (
              <IdealCustomerTypeExportPanel
                key={tenantId + "-ideal"}
                tenantId={tenantId}
              />
            ) : null}
            <Stack direction="row" gap={1} alignItems="flex-start">
              <Box sx={{ color: "primary.600", pt: 0.25 }}>
                <MessageCircle size={18} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <IntelligenceSectionHeader
                  title="Customer communication channels"
                  description="Check readiness before deciding whether to send a campaign. Consent and delivery status are not inferred from a purchase."
                />
              </Box>
            </Stack>
            {tenantId && <CampaignReadinessPanel key={tenantId + "-email-readiness"} tenantId={tenantId} />}
            <PushReadinessPanel />
            <IntelligenceActions justifyContent="flex-start">
              <Button
                size="sm"
                variant="plain"
                color="neutral"
                aria-expanded={advanced}
                aria-controls="intelligence-advanced-channels"
                endDecorator={<ChevronRight size={14} />}
                onClick={() => setAdvanced((value) => !value)}
              >
                {advanced
                  ? "Hide advanced channel setup"
                  : "Show advanced channel setup"}
              </Button>
            </IntelligenceActions>
            <Box id="intelligence-advanced-channels">
              {advanced && <PushPilotPanel />}
            </Box>
          </TabPanelBox>
        )}
      </Stack>
    </PageContainer>
  );
}
