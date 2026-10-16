import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
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
  CheckCircle2,
  ChevronRight,
  Compass,
  Database,
  Gift,
  Layers3,
  Leaf,
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
import { ImportedReportsPanel } from "@/components/crm/customer-intelligence/ImportedReportsPanel";
import { CustomerGrowthWorkspace } from "@/components/crm/customer-intelligence/CustomerGrowthWorkspace";
import { LoyaltyProgrammeWorkspace } from "@/components/crm/customer-intelligence/LoyaltyProgrammeWorkspace";
import { IdealCustomerTypeExportPanel } from "@/components/crm/customer-intelligence/IdealCustomerTypeExportPanel";
import { PushPilotPanel } from "@/components/crm/customer-intelligence/PushPilotPanel";
import { PushReadinessPanel } from "@/components/crm/customer-intelligence/PushReadinessPanel";
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

const white = "rgba(255,255,255,0.92)";
const mutedWhite = "rgba(255,255,255,0.72)";
const num = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);
const person = (row: IntelligenceRow) =>
  [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
  row.email ||
  "Customer profile";

const VIEWS = [
  {
    id: "overview" as const,
    title: "Overview",
    description: "Start here",
    icon: Compass,
  },
  {
    id: "explore" as const,
    title: "Find customers",
    description: "Ask & segment",
    icon: Search,
  },
  {
    id: "growth" as const,
    title: "Growth",
    description: "Compare history",
    icon: ChartNoAxesCombined,
  },
  {
    id: "rewards" as const,
    title: "Rewards",
    description: "Plan & measure",
    icon: Gift,
  },
  {
    id: "data" as const,
    title: "Data & channels",
    description: "Connect & validate",
    icon: Database,
  },
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

function BotanicalLines() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: "absolute",
        right: { xs: -90, md: 6 },
        top: { xs: 8, md: -10 },
        width: { xs: 270, md: 405 },
        opacity: 0.24,
        pointerEvents: "none",
      }}
    >
      <svg
        viewBox="0 0 390 350"
        width="100%"
        fill="none"
        stroke="#F3D6C7"
        strokeWidth="1.5"
      >
        <circle cx="216" cy="160" r="139" strokeDasharray="2 11" />
        <circle cx="216" cy="160" r="111" opacity=".55" />
        <path d="M121 317C170 242 199 171 229 65" strokeWidth="2.8" />
        <path d="M186 235C122 224 97 176 100 154C152 159 185 188 186 235Z" />
        <path d="M205 184C263 169 294 131 297 99C254 112 225 144 205 184Z" />
        <path d="M226 80C177 65 161 32 162 15C206 27 228 47 226 80Z" />
        <path d="M151 285C120 282 95 254 88 223C130 228 145 254 151 285Z" />
        <path d="M164 260C225 259 262 224 275 197C220 196 185 216 164 260Z" />
        <path
          d="M117 318C167 270 228 266 304 289"
          strokeWidth="1"
          strokeDasharray="5 8"
        />
        <circle cx="299" cy="289" r="4" fill="#F3D6C7" stroke="none" />
      </svg>
    </Box>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      alignItems={{ md: "flex-end" }}
      justifyContent="space-between"
      gap={2}
      sx={{ mb: 2.5 }}
    >
      <Stack spacing={0.75}>
        <Typography
          level="body-xs"
          sx={{
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "primary.600",
          }}
        >
          {eyebrow}
        </Typography>
        <Typography
          level="h2"
          sx={{
            fontSize: { xs: "1.6rem", md: "2rem" },
            letterSpacing: "-0.035em",
            lineHeight: 1.13,
          }}
        >
          {title}
        </Typography>
        <Typography
          level="body-md"
          sx={{ color: "text.secondary", maxWidth: 700, lineHeight: 1.65 }}
        >
          {description}
        </Typography>
      </Stack>
      {action}
    </Stack>
  );
}

function BloomCompanion({
  view,
  onAsk,
}: {
  view: IntelligenceView;
  onAsk: (question: string) => void;
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
  return (
    <Sheet
      variant="outlined"
      sx={{
        p: { xs: 2.25, md: 3 },
        borderRadius: "22px",
        borderColor: "neutral.outlinedBorder",
        boxShadow: "sm",
        background:
          "linear-gradient(125deg,rgba(244,239,233,.68),rgba(255,255,255,.97) 58%,rgba(244,240,246,.65))",
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" gap={1.5} alignItems="center">
          <Sheet
            sx={{
              width: 42,
              height: 42,
              flexShrink: 0,
              bgcolor: "#242C3B",
              color: "#fff",
              borderRadius: "14px",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Sparkles size={20} />
          </Sheet>
          <Box sx={{ flex: 1 }}>
            <Typography level="title-lg" sx={{ fontWeight: 750 }}>
              Ask Bloom
            </Typography>
            <Typography level="body-sm" color="neutral">
              {context.caption}
            </Typography>
          </Box>
          <Chip size="sm" variant="soft" color="neutral">
            Uses recorded evidence
          </Chip>
        </Stack>
        <Box component="form" onSubmit={submit}>
          <Stack spacing={1}>
            <Textarea
              aria-label="Ask Bloom about your customers"
              minRows={2}
              maxRows={5}
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
                borderRadius: "lg",
                "--Textarea-focusedThickness": "1px",
              }}
            />
            {error && (
              <Typography role="alert" level="body-sm" color="danger">
                {error}
              </Typography>
            )}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap={1}
            >
              <Typography level="body-xs" color="neutral">
                Opens Bloom with your question ready to review. Nothing is sent
                automatically.
              </Typography>
              <Button
                type="submit"
                startDecorator={<Sparkles size={16} />}
                sx={{ borderRadius: "lg" }}
              >
                Continue in Bloom <ArrowRight size={15} />
              </Button>
            </Stack>
          </Stack>
        </Box>
        <Divider />
        <Typography
          level="body-xs"
          sx={{ fontWeight: 700, color: "text.tertiary" }}
        >
          Not sure where to start?
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          <Button
            size="sm"
            variant="outlined"
            color="neutral"
            onClick={() => onAsk(context.question)}
          >
            <Sparkles size={13} />{" "}
            {view === "overview"
              ? "Find my best opportunities"
              : "Guide me through this"}
          </Button>
          {(view === "overview"
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
            : view === "explore"
              ? [
                  {
                    text: "Build an audience",
                    query: INTELLIGENCE_QUESTIONS.discover,
                  },
                ]
              : view === "growth"
                ? [
                    {
                      text: "Understand inactivity",
                      query: INTELLIGENCE_QUESTIONS.gaps,
                    },
                  ]
                : view === "rewards"
                  ? [
                      {
                        text: "Plan a win-back",
                        query: INTELLIGENCE_QUESTIONS.rewards,
                      },
                    ]
                  : [
                      {
                        text: "Check source quality",
                        query: INTELLIGENCE_QUESTIONS.sources,
                      },
                    ]
          ).map((item) => (
            <Button
              key={item.text}
              size="sm"
              variant="plain"
              color="neutral"
              onClick={() => onAsk(item.query)}
            >
              {item.text}
              <ArrowUpRight size={12} />
            </Button>
          ))}
        </Stack>
      </Stack>
    </Sheet>
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
    <Button
      onClick={onClick}
      variant="outlined"
      color="neutral"
      sx={{
        width: "100%",
        minHeight: 191,
        alignItems: "stretch",
        justifyContent: "space-between",
        flexDirection: "column",
        textAlign: "left",
        p: 2.5,
        borderRadius: "20px",
        bgcolor: "background.surface",
        borderColor: "neutral.outlinedBorder",
        transition:
          "box-shadow .16s ease,transform .16s ease,border-color .16s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "md",
          borderColor: "primary.300",
          bgcolor: "background.surface",
        },
      }}
    >
      <Stack
        direction="row"
        sx={{ width: "100%" }}
        justifyContent="space-between"
        alignItems="center"
      >
        <Sheet
          variant="soft"
          color="neutral"
          sx={{
            width: 46,
            height: 46,
            borderRadius: "14px",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon size={22} strokeWidth={1.8} />
        </Sheet>
        <Typography
          level="body-xs"
          sx={{
            fontWeight: 800,
            color: "text.tertiary",
            letterSpacing: ".11em",
          }}
        >
          {step}
        </Typography>
      </Stack>
      <Stack spacing={0.6} sx={{ width: "100%", mt: 2 }}>
        <Typography level="title-lg" sx={{ fontSize: "1.15rem" }}>
          {title}
        </Typography>
        <Typography
          level="body-sm"
          sx={{
            color: "text.secondary",
            fontWeight: 450,
            whiteSpace: "normal",
            lineHeight: 1.6,
          }}
        >
          {description}
        </Typography>
        <Typography
          level="body-sm"
          sx={{ fontWeight: 750, color: "primary.600", mt: 1 }}
        >
          {action} <ArrowRight size={14} style={{ verticalAlign: "middle" }} />
        </Typography>
      </Stack>
    </Button>
  );
}

function SummaryMetric({
  title,
  value,
  explanation,
  icon: Icon,
}: {
  title: string;
  value: string;
  explanation: string;
  icon: typeof Search;
}) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: "18px",
        borderColor: "neutral.outlinedBorder",
        bgcolor: "background.surface",
        minHeight: 143,
        display: "flex",
        flexDirection: "column",
        gap: 0.8,
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={1}
      >
        <Typography level="body-sm" color="neutral" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Icon size={18} strokeWidth={1.7} color="#777583" />
      </Stack>
      <Typography
        sx={{
          fontSize: { xs: "1.8rem", md: "2rem" },
          fontWeight: 780,
          letterSpacing: "-0.035em",
          lineHeight: 1.1,
        }}
      >
        {value}
      </Typography>
      <Typography
        level="body-xs"
        sx={{ color: "text.tertiary", lineHeight: 1.5 }}
      >
        {explanation}
      </Typography>
    </Sheet>
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
    <Stack spacing={2.25}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ md: "center" }}
        gap={1}
      >
        <Stack spacing={0.35}>
          <Typography
            level="h3"
            sx={{ fontSize: "1.35rem", letterSpacing: "-0.02em" }}
          >
            A snapshot of your customer records
          </Typography>
          <Typography level="body-sm" color="neutral">
            Useful starting signals, not automatic lifecycle labels or a
            prediction of lost sales.
          </Typography>
        </Stack>
        {refreshedAt > 0 && !error && (
          <Typography level="body-xs" color="neutral">
            Last loaded{" "}
            {new Date(refreshedAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </Typography>
        )}
      </Stack>
      {loading && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4,1fr)" },
            gap: 1.5,
          }}
        >
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              sx={{ height: 145, borderRadius: "lg" }}
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
        <Sheet variant="soft" sx={{ borderRadius: "lg", p: 3 }}>
          <Stack spacing={1.5} alignItems="flex-start">
            <Typography level="title-lg">
              Your customer story starts with a source.
            </Typography>
            <Typography level="body-md">
              There are no accessible customer-intelligence records to summarize
              yet. Connect a source or review your existing imports first.
            </Typography>
            <Button
              variant="outlined"
              color="neutral"
              onClick={() => onView("data")}
            >
              Review data & connections <ArrowRight size={14} />
            </Button>
          </Stack>
        </Sheet>
      )}
      {!loading && !error && rows.length > 0 && (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4,1fr)" },
              gap: 1.5,
            }}
          >
            <SummaryMetric
              icon={UsersRound}
              title="Profiles with lifetime spending"
              value={rows.some(r => num(r.lifetime_value)) ? withHistory.length.toLocaleString() : "Not measured"}
              explanation={
                "Out of " +
                rows.length.toLocaleString() +
                " accessible customer records"
              }
            />
            <SummaryMetric
              icon={Activity}
              title="Negative momentum signals"
              value={rows.some(r => num(r.purchase_velocity)) ? slowing.length.toLocaleString() : "Not measured"}
              explanation="Recorded purchase-velocity signals; verify seasons before targeting"
            />
            <SummaryMetric
              icon={CalendarDays}
              title="120+ day purchase gaps"
              value={rows.some(r => num(r.days_since_last_purchase)) ? longGaps.length.toLocaleString() : "Not measured"}
              explanation="A review prompt, not proof that these customers are lapsed"
            />
            <SummaryMetric
              icon={Layers3}
              title="Product affinities"
              value={rows.some(r => Array.isArray(r.top_product_categories)) ? categories.size.toLocaleString() : "Not measured"}
              explanation="Distinct categories appearing in the available customer data"
            />
          </Box>
          <Alert
            variant="soft"
            color="neutral"
            startDecorator={<ShieldCheck size={18} />}
          >
            {missingHistory} records do not show a positive lifetime spending value. Imported period reports may still contain useful purchase history. Missing data and zero purchases are not the same. Bloom
            can help check the underlying evidence.
          </Alert>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(0,1.22fr) minmax(0,0.78fr)",
              },
              gap: 2,
            }}
          >
            <Sheet
              variant="outlined"
              sx={{ borderRadius: "20px", p: { xs: 2.25, md: 2.75 } }}
            >
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  gap={1}
                >
                  <Stack spacing={0.2}>
                    <Typography level="title-lg">
                      Opportunities worth your attention
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      Start with evidence. Decide on a campaign later.
                    </Typography>
                  </Stack>
                  <IconButton
                    variant="plain"
                    color="neutral"
                    aria-label="Explore customer opportunities with Bloom"
                    onClick={() => onAsk(INTELLIGENCE_QUESTIONS.opportunities)}
                  >
                    <Sparkles size={19} />
                  </IconButton>
                </Stack>
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
                      gap={1.5}
                      alignItems="flex-start"
                      sx={{
                        pt: i ? 2 : 0,
                        borderTop: i ? "1px solid" : 0,
                        borderColor: "divider",
                      }}
                    >
                      <Sheet
                        variant="soft"
                        sx={{
                          width: 39,
                          height: 39,
                          borderRadius: "lg",
                          flexShrink: 0,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Icon size={18} />
                      </Sheet>
                      <Stack spacing={0.6} sx={{ flex: 1, minWidth: 0 }}>
                        <Typography level="title-md">{item.title}</Typography>
                        <Typography
                          level="body-sm"
                          color="neutral"
                          sx={{ lineHeight: 1.55 }}
                        >
                          {item.details}
                        </Typography>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          flexWrap="wrap"
                          gap={1}
                        >
                          <Chip variant="soft" color="neutral" size="sm">
                            {item.count.toLocaleString()} observed
                          </Chip>
                          <Button
                            size="sm"
                            variant="plain"
                            onClick={() => onAsk(item.prompt)}
                          >
                            Examine with Bloom <ArrowRight size={14} />
                          </Button>
                        </Stack>
                      </Stack>
                    </Stack>
                  );
                })}
              </Stack>
            </Sheet>
            <Sheet
              variant="outlined"
              sx={{ borderRadius: "20px", p: { xs: 2.25, md: 2.75 } }}
            >
              <Stack spacing={1.75}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Stack spacing={0.2}>
                    <Typography level="title-lg">
                      What customers are buying
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      Recorded category affinities
                    </Typography>
                  </Stack>
                  <Layers3 size={20} color="#777583" />
                </Stack>
                {topCategories.length ? (
                  topCategories.map(([category, count], index) => (
                    <Stack
                      key={category}
                      direction="row"
                      alignItems="center"
                      gap={1.3}
                    >
                      <Sheet
                        variant="soft"
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: "md",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Typography level="body-xs" sx={{ fontWeight: 800 }}>
                          {String(index + 1).padStart(2, "0")}
                        </Typography>
                      </Sheet>
                      <Typography
                        level="body-sm"
                        sx={{ flex: 1, fontWeight: 600 }}
                      >
                        {category}
                      </Typography>
                      <Typography level="body-sm" color="neutral">
                        {count} profiles
                      </Typography>
                    </Stack>
                  ))
                ) : (
                  <Typography level="body-sm" color="neutral">
                    Category history is not available for these profiles.
                  </Typography>
                )}
                <Button
                  variant="plain"
                  size="sm"
                  sx={{ alignSelf: "flex-start" }}
                  onClick={() => onAsk(INTELLIGENCE_QUESTIONS.categories)}
                >
                  Explore products with Bloom <ArrowRight size={14} />
                </Button>
              </Stack>
            </Sheet>
          </Box>
          {slowing.length > 0 && (
            <Sheet
              variant="outlined"
              sx={{ borderRadius: "20px", p: { xs: 2.25, md: 2.75 } }}
            >
              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  gap={1}
                >
                  <Stack>
                    <Typography level="title-lg">
                      Customers to explore
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      A small sample of records with reported slowing momentum.
                    </Typography>
                  </Stack>
                  <Chip size="sm" color="neutral" variant="soft">
                    Sample · not a saved segment
                  </Chip>
                </Stack>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" },
                    gap: 1.25,
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
                          p: 1.75,
                          borderRadius: "lg",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          textAlign: "left",
                          gap: 0.5,
                        }}
                      >
                        <Typography level="title-sm">{person(row)}</Typography>
                        <Typography level="body-xs" color="neutral">
                          {num(row.purchase_velocity)
                            ? "Recorded momentum " +
                              row.purchase_velocity.toFixed(1)
                            : "Momentum history requires review"}
                        </Typography>
                        <Typography
                          level="body-xs"
                          sx={{
                            color: "primary.600",
                            fontWeight: 700,
                            mt: 0.5,
                          }}
                        >
                          Open purchase history <ArrowRight size={12} />
                        </Typography>
                      </Button>
                    ))}
                </Box>
                <Typography level="body-xs" color="neutral">
                  Explore and verify the customer history before saving an
                  audience. Missing purchase dates or seasonal buying can change
                  the interpretation.
                </Typography>
              </Stack>
            </Sheet>
          )}
        </>
      )}
    </Stack>
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

  return (
    <PageContainer sx={{ py: { xs: 2, md: 3 }, maxWidth: 1520 }}>
      <Stack spacing={{ xs: 2.5, md: 3.5 }}>
        <Sheet
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: { xs: "23px", md: "30px" },
            p: { xs: 3, md: 4.5 },
            color: "#fff",
            background:
              "linear-gradient(112deg,#202938 0%,#263447 63%,#3A3040 100%)",
            minHeight: { xs: 235, md: 255 },
          }}
        >
          <BotanicalLines />
          <Stack
            spacing={2}
            sx={{ position: "relative", zIndex: 1, maxWidth: 840 }}
          >
            <Stack direction="row" alignItems="center" gap={1}>
              <Leaf size={16} color="#E8BEAD" />
              <Typography
                level="body-xs"
                sx={{
                  color: mutedWhite,
                  letterSpacing: ".13em",
                  fontWeight: 800,
                  textTransform: "uppercase",
                }}
              >
                BloomSuite / Customer Intelligence
              </Typography>
            </Stack>
            <Typography
              level="h1"
              sx={{
                color: white,
                fontSize: { xs: "2rem", md: "2.7rem" },
                letterSpacing: "-0.044em",
                maxWidth: 800,
                lineHeight: 1.1,
              }}
            >
              Know your customers. Know what to do next.
            </Typography>
            <Typography
              level="body-lg"
              sx={{ color: mutedWhite, maxWidth: 670, lineHeight: 1.65 }}
            >
              Find the right customers, understand how their shopping is
              changing, and build thoughtful reasons to come back. All in one
              clear place.
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              <Chip
                variant="soft"
                size="sm"
                color="neutral"
                startDecorator={<CheckCircle2 size={13} />}
              >
                Evidence before recommendations
              </Chip>
              <Chip
                variant="soft"
                size="sm"
                color="neutral"
                startDecorator={<ShieldCheck size={13} />}
              >
                No automatic messages or offers
              </Chip>
            </Stack>
          </Stack>
        </Sheet>

        <Box
          component="nav"
          aria-label="Intelligence sections"
          sx={{
            display: "flex",
            width: "100%",
            overflowX: "auto",
            gap: 0.75,
            borderBottom: "1px solid",
            borderColor: "neutral.outlinedBorder",
            pb: 1.25,
            scrollbarWidth: "thin",
          }}
        >
          {VIEWS.map((item) => {
            const Icon = item.icon;
            const selected = item.id === active;
            return (
              <Button
                key={item.id}
                color="neutral"
                variant={selected ? "soft" : "plain"}
                aria-current={selected ? "page" : undefined}
                onClick={() => changeView(item.id)}
                sx={{
                  borderRadius: "13px",
                  flexShrink: 0,
                  py: 1.2,
                  px: { xs: 1.45, md: 2.2 },
                  minHeight: 48,
                  display: "flex",
                  gap: 1.1,
                  alignItems: "center",
                  bgcolor: selected ? "neutral.softBg" : "transparent",
                  border: "1px solid",
                  borderColor: selected
                    ? "neutral.outlinedBorder"
                    : "transparent",
                  boxShadow: selected ? "sm" : "none",
                  "&:hover": { bgcolor: "neutral.softHoverBg" },
                }}
              >
                <Icon size={18} strokeWidth={selected ? 2.15 : 1.8} />
                <Stack spacing={0} alignItems="flex-start">
                  <Typography level="title-sm">{item.title}</Typography>
                  <Typography
                    level="body-xs"
                    sx={{
                      color: "text.tertiary",
                      display: { xs: "none", lg: "block" },
                    }}
                  >
                    {item.description}
                  </Typography>
                </Stack>
              </Button>
            );
          })}
        </Box>

        <BloomCompanion view={active} onAsk={askBloom} />

        {visited.includes("overview") && (
          <Box
            hidden={active !== "overview"}
            sx={{ display: active === "overview" ? "block" : "none" }}
          >
            <Stack spacing={3}>
              <Box>
                <SectionTitle
                  eyebrow="Start with a goal"
                  title="What would you like to do today?"
                  description="Follow a simple flow. Every step connects to the same customer records; nothing gets lost behind another dashboard."
                />
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2,minmax(0,1fr))",
                      lg: "repeat(3,minmax(0,1fr))",
                    },
                    gap: 1.5,
                  }}
                >
                  <TaskCard
                    step="01 / DISCOVER"
                    icon={UsersRound}
                    title="Find the right customers"
                    description="Search purchase history, create an exact group, and understand why each person qualifies."
                    action="Find an audience"
                    onClick={() => changeView("explore")}
                  />
                  <TaskCard
                    step="02 / UNDERSTAND"
                    icon={ChartNoAxesCombined}
                    title="See what is changing"
                    description="Compare visits and spending against a meaningful historical period."
                    action="Measure growth"
                    onClick={() => changeView("growth")}
                  />
                  <TaskCard
                    step="03 / ACT & LEARN"
                    icon={Gift}
                    title="Give them a reason to return"
                    description="Plan a reward, review the exact people, and measure what happens afterward."
                    action="Explore rewards"
                    onClick={() => changeView("rewards")}
                  />
                </Box>
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
              <Sheet
                variant="soft"
                sx={{ borderRadius: "20px", p: { xs: 2.5, md: 3 } }}
              >
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  alignItems={{ md: "center" }}
                  justifyContent="space-between"
                  gap={2}
                >
                  <Stack spacing={0.7}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Database size={18} />
                      <Typography level="title-lg">
                        Are your records ready to trust?
                      </Typography>
                    </Stack>
                    <Typography
                      level="body-sm"
                      color="neutral"
                      sx={{ maxWidth: 700 }}
                    >
                      Keep original POS files, review missing transactions, and
                      check import dates before relying on growth scores or
                      starting outreach.
                    </Typography>
                  </Stack>
                  <Button
                    variant="outlined"
                    color="neutral"
                    onClick={() => changeView("data")}
                  >
                    Review sources & channels <ArrowRight size={15} />
                  </Button>
                </Stack>
              </Sheet>
            </Stack>
          </Box>
        )}

        {visited.includes("explore") && (
          <Box
            hidden={active !== "explore"}
            sx={{ display: active === "explore" ? "block" : "none" }}
          >
            <SectionTitle
              eyebrow="Step 01 · Discover"
              title="Find a group worth understanding"
              description="Ask Bloom a precise question about products or buying patterns, then inspect the matching, excluded, and unknown customers before saving your group."
              action={
                <Button
                  variant="outlined"
                  color="neutral"
                  onClick={() => navigate("/crm/segments")}
                >
                  Open audience builder <ArrowUpRight size={14} />
                </Button>
              }
            />
            <Stack spacing={2}>
              <CustomerGrowthWorkspace
                key={String(tenantId) + "-explore"}
                section="explore"
              />
              <Sheet variant="soft" sx={{ p: 2.5, borderRadius: "lg" }}>
                <Stack direction="row" gap={1.5} alignItems="flex-start">
                  <ShieldCheck size={21} strokeWidth={1.7} />
                  <Stack spacing={0.5}>
                    <Typography level="title-sm">
                      Know exactly why someone matches.
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      Bloom preserves follow-up customer sets. Check source
                      evidence and missing data, then save a static group or
                      build a dynamic segment. No one is contacted
                      automatically.
                    </Typography>
                  </Stack>
                </Stack>
              </Sheet>
            </Stack>
          </Box>
        )}

        {visited.includes("growth") && (
          <Box
            hidden={active !== "growth"}
            sx={{ display: active === "growth" ? "block" : "none" }}
          >
            <SectionTitle
              eyebrow="Step 02 · Understand"
              title="Make sense of changing customer habits"
              description="Compare each customer with their own historical spending and number of visits. Index 100 means no change; customers without a comparable baseline remain unscored."
            />
            <CustomerGrowthWorkspace
              key={String(tenantId) + "-growth"}
              section="growth"
            />
          </Box>
        )}

        {visited.includes("rewards") && (
          <Box
            hidden={active !== "rewards"}
            sx={{ display: active === "rewards" ? "block" : "none" }}
          >
            <SectionTitle
              eyebrow="Step 03 · Act & learn"
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
            <Sheet variant="soft" sx={{ borderRadius: "lg", p: 2.5, mt: 2 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                gap={1.5}
                alignItems={{ sm: "center" }}
                justifyContent="space-between"
              >
                <Stack spacing={0.4}>
                  <Typography level="title-md">
                    Need a little help designing a programme?
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    Bloom can propose a budget-conscious campaign using reviewed
                    customer groups.
                  </Typography>
                </Stack>
                <Button
                  variant="outlined"
                  color="neutral"
                  onClick={() => askBloom(INTELLIGENCE_QUESTIONS.rewards)}
                >
                  Plan with Bloom <Sparkles size={15} />
                </Button>
              </Stack>
            </Sheet>
          </Box>
        )}

        {visited.includes("data") && (
          <Box
            hidden={active !== "data"}
            sx={{ display: active === "data" ? "block" : "none" }}
          >
            <SectionTitle
              eyebrow="Foundation"
              title="Make sure the information is dependable"
              description="Connect your point of sale, prepare reviewed exports, and see which communication channels are ready. Advanced pilot controls stay out of the everyday workflow."
              action={
                <Button
                  variant="outlined"
                  color="neutral"
                  onClick={() => navigate("/crm/pos")}
                >
                  POS integrations <ArrowUpRight size={14} />
                </Button>
              }
            />
            <Stack spacing={2}>
              <Sheet
                variant="outlined"
                sx={{ p: { xs: 2.5, md: 3 }, borderRadius: "20px" }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  gap={1.5}
                  alignItems={{ sm: "center" }}
                >
                  <Sheet
                    variant="soft"
                    sx={{
                      width: 45,
                      height: 45,
                      borderRadius: "lg",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Database size={22} />
                  </Sheet>
                  <Stack spacing={0.4} sx={{ flex: 1 }}>
                    <Typography level="title-lg">
                      Your POS remains the source of purchase truth.
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      Grouped reports cannot establish visits. Review identity
                      matches and source coverage before using your
                      customer-growth results.
                    </Typography>
                  </Stack>
                  <Button
                    variant="soft"
                    color="neutral"
                    onClick={() => askBloom(INTELLIGENCE_QUESTIONS.sources)}
                  >
                    Ask Bloom about my sources <ArrowRight size={14} />
                  </Button>
                </Stack>
              </Sheet>
              {tenantId ? (
                <IdealCustomerTypeExportPanel
                  key={tenantId + "-ideal"}
                  tenantId={tenantId}
                />
              ) : null}
              <Sheet
                variant="outlined"
                sx={{ borderRadius: "20px", p: { xs: 2.5, md: 3 } }}
              >
                <Stack spacing={1.5}>
                  <Stack direction="row" gap={1} alignItems="center">
                    <MessageCircle size={19} />
                    <Typography level="title-lg">
                      Customer communication channels
                    </Typography>
                  </Stack>
                  <Typography level="body-sm" color="neutral">
                    Check readiness before deciding whether to send a campaign.
                    Consent and delivery status are not inferred from a
                    purchase.
                  </Typography>
                  <PushReadinessPanel />
                  <Divider />
                  <Button
                    variant="plain"
                    color="neutral"
                    aria-expanded={advanced}
                    aria-controls="intelligence-advanced-channels"
                    sx={{ alignSelf: "flex-start" }}
                    onClick={() => setAdvanced((value) => !value)}
                  >
                    {advanced
                      ? "Hide advanced channel setup"
                      : "Show advanced channel setup"}{" "}
                    <ChevronRight size={16} />
                  </Button>
                  <Box id="intelligence-advanced-channels">
                    {advanced && <PushPilotPanel />}
                  </Box>
                </Stack>
              </Sheet>
            </Stack>
          </Box>
        )}
      </Stack>
    </PageContainer>
  );
}
