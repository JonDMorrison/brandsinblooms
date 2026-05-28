import * as React from "react";
import Box from "@mui/joy/Box";
import Skeleton from "@mui/joy/Skeleton";
import Typography from "@mui/joy/Typography";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Layers,
  Mail,
  Package,
  Pin,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BloomAvatar } from "@/components/bloom/BloomAvatar";
import { useBloom } from "@/components/bloom/BloomContext";
import { BloomInsightsSection } from "@/components/bloom/BloomInsightsSection";
import { JoyChip } from "@/components/joy/JoyChip";
import { useAuth } from "@/contexts/AuthContext";
import {
  useBloomDailySnapshot,
  type DailySnapshot,
} from "@/hooks/bloom/useBloomDailySnapshot";
import { useBloomInsights } from "@/hooks/bloom/useBloomInsights";
import { useBloomOnboarding } from "@/hooks/bloom/useBloomOnboarding";
import { useBloomProfile } from "@/hooks/bloom/useBloomProfile";
import { useBloomProfileMutations } from "@/hooks/bloom/useBloomProfileMutations";
import type {
  BloomEntitySummary,
  BloomPageEntityType,
} from "@/hooks/bloom/types";
import {
  useBloomSuggestions,
  type BloomSuggestionCategory,
} from "@/hooks/bloom/useBloomSuggestions";
import {
  normalizeBloomWorkspaceMemory,
  type BloomWorkspaceMemoryPinnedEntity,
} from "@/hooks/bloom/workspaceMemory";
import { useTenant } from "@/hooks/useTenant";

const promptCardSkeletons = [0, 1, 2, 3] as const;
const snapshotPrompt = "How's business going today?";
const STARTER_PROMPTS = [
  "Show me my customers",
  snapshotPrompt,
  "Check my inventory",
  "Campaign performance",
] as const;

const motionEase = [0.2, 0, 0, 1] as const;

const capabilityCards = [
  {
    title: "Customers",
    description: "View and search your list",
    Icon: Users,
  },
  {
    title: "Inventory",
    description: "Track stock and products",
    Icon: Package,
  },
  {
    title: "Analytics",
    description: "See your business metrics",
    Icon: TrendingUp,
  },
  {
    title: "Campaigns",
    description: "Email and SMS performance",
    Icon: Mail,
  },
] as const;

const suggestionCategoryLabels: Record<BloomSuggestionCategory, string> = {
  analytics: "Analytics",
  business: "Business",
  campaign: "Marketing",
  customer: "Customers",
  product: "Inventory",
};

const entityCategoryLabels: Record<BloomPageEntityType, string> = {
  campaign: "Campaign",
  customer: "Customer",
  product: "Product",
  segment: "Segment",
};

const pinnedEntityMeta: Record<
  BloomPageEntityType,
  { Icon: LucideIcon; label: string }
> = {
  campaign: { Icon: Mail, label: "Campaign" },
  customer: { Icon: Users, label: "Customer" },
  product: { Icon: Package, label: "Product" },
  segment: { Icon: Layers, label: "Segment" },
};

type HomeTimeContext = {
  formattedDate: string;
  greeting: string;
};

type HomePromptSuggestion = {
  categoryLabel?: string;
  displayText: string;
  prompt: string;
};

type EntityPromptBlueprint = {
  label: string;
  buildPrompt: (summary: BloomEntitySummary) => string;
};

const ENTITY_PROMPT_BLUEPRINTS: Record<
  BloomPageEntityType,
  readonly EntityPromptBlueprint[]
> = {
  customer: [
    {
      label: "Tell me about this customer",
      buildPrompt: (summary) =>
        `Tell me about customer ${summary.name} (ID: ${summary.entityId})`,
    },
    {
      label: "Show their order history",
      buildPrompt: (summary) =>
        `Show the order history for customer ${summary.name} (ID: ${summary.entityId})`,
    },
    {
      label: "Add to a segment",
      buildPrompt: (summary) =>
        `Add customer ${summary.name} (ID: ${summary.entityId}) to a segment`,
    },
    {
      label: "Create a campaign for them",
      buildPrompt: (summary) =>
        `Create a campaign for customer ${summary.name} (ID: ${summary.entityId})`,
    },
  ],
  product: [
    {
      label: "Generate a description",
      buildPrompt: (summary) =>
        `Generate a description for product ${summary.name} (ID: ${summary.entityId})`,
    },
    {
      label: "Check stock levels",
      buildPrompt: (summary) =>
        `Check stock levels for product ${summary.name} (ID: ${summary.entityId})`,
    },
    {
      label: "Update price",
      buildPrompt: (summary) =>
        `Update the price for product ${summary.name} (ID: ${summary.entityId})`,
    },
    {
      label: "Compare with similar products",
      buildPrompt: (summary) =>
        `Compare product ${summary.name} (ID: ${summary.entityId}) with similar products`,
    },
  ],
  campaign: [
    {
      label: "How did this campaign perform?",
      buildPrompt: (summary) =>
        `How did campaign ${summary.name} (ID: ${summary.entityId}) perform?`,
    },
    {
      label: "Generate better subject lines",
      buildPrompt: (summary) =>
        `Generate better subject lines for campaign ${summary.name} (ID: ${summary.entityId})`,
    },
    {
      label: "Clone this campaign",
      buildPrompt: (summary) =>
        `Clone campaign ${summary.name} (ID: ${summary.entityId})`,
    },
    {
      label: "Show audience details",
      buildPrompt: (summary) =>
        `Show audience details for campaign ${summary.name} (ID: ${summary.entityId})`,
    },
  ],
  segment: [
    {
      label: "Show segment members",
      buildPrompt: (summary) =>
        `Show members for segment ${summary.name} (ID: ${summary.entityId})`,
    },
    {
      label: "Create a campaign for this segment",
      buildPrompt: (summary) =>
        `Create a campaign for segment ${summary.name} (ID: ${summary.entityId})`,
    },
    {
      label: "Compare with other segments",
      buildPrompt: (summary) =>
        `Compare segment ${summary.name} (ID: ${summary.entityId}) with other segments`,
    },
    {
      label: "Analyze member behavior",
      buildPrompt: (summary) =>
        `Analyze member behavior for segment ${summary.name} (ID: ${summary.entityId})`,
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getDisplayName(metadata: unknown, email: string | undefined) {
  const record = isRecord(metadata) ? metadata : {};
  const profileName =
    readString(record.full_name) ??
    readString(record.fullName) ??
    readString(record.first_name) ??
    readString(record.firstName) ??
    readString(record.name);

  if (profileName) {
    return profileName.split(/\s+/)[0] ?? "there";
  }

  if (email?.trim()) {
    return email.split("@")[0] ?? "there";
  }

  return "there";
}

function getTimeGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }

  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }

  if (hour >= 17 && hour < 22) {
    return "Good evening";
  }

  return "Working late";
}

function getHomeTimeContext(): HomeTimeContext {
  return {
    greeting: getTimeGreeting(),
    formattedDate: new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "long",
      weekday: "long",
    }).format(new Date()),
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat(undefined, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);

const formatInteger = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);

function hasSnapshotActivity(snapshot: DailySnapshot) {
  return (
    snapshot.revenueToday > 0 ||
    snapshot.newCustomersToday > 0 ||
    snapshot.activeCampaignsCount > 0 ||
    snapshot.pendingOrdersCount > 0
  );
}

function getMotionContainerVariants(delayChildren: number): Variants {
  return {
    hidden: {},
    visible: {
      transition: {
        delayChildren,
        staggerChildren: 0.08,
      },
    },
  };
}

function getMotionItemVariants(prefersReducedMotion: boolean): Variants {
  if (prefersReducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.2 } },
    };
  }

  return {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      transition: { duration: 0.5, ease: motionEase },
      y: 0,
    },
  };
}

function HomeScrollContainer({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        height: "100%",
        overflow: "auto",
        overflowX: "hidden",
        scrollbarColor: "var(--joy-palette-neutral-200) transparent",
        scrollbarWidth: "thin",
        width: "100%",
        "&::-webkit-scrollbar": { width: 6 },
        "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "neutral.200",
          borderRadius: 3,
        },
        "&::-webkit-scrollbar-thumb:hover": {
          backgroundColor: "neutral.300",
        },
      }}
    >
      {children}
    </Box>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        color: "neutral.500",
        fontSize: "11px",
        fontWeight: 500,
        letterSpacing: "0.08em",
        lineHeight: 1.4,
        textTransform: "uppercase",
      }}
    >
      {children}
    </Typography>
  );
}

function PromptCardSkeleton() {
  const prefersReducedMotion = useReducedMotion() === true;

  return (
    <Box
      sx={{
        minHeight: 88,
        p: 2,
        borderRadius: "var(--joy-radius-xl)",
        border: "1px solid",
        borderColor: "neutral.outlinedBorder",
        backgroundColor: "background.surface",
      }}
    >
      <Skeleton
        animation={prefersReducedMotion ? false : "pulse"}
        variant="text"
        width="34%"
        sx={{ height: 14, mb: 1 }}
      />
      <Skeleton
        animation={prefersReducedMotion ? false : "pulse"}
        variant="text"
        width="86%"
        sx={{ height: 22 }}
      />
      <Skeleton
        animation={prefersReducedMotion ? false : "pulse"}
        variant="text"
        width="58%"
        sx={{ height: 18 }}
      />
    </Box>
  );
}

function PromptCard({
  disabled,
  onSelect,
  suggestion,
}: {
  disabled: boolean;
  onSelect: (prompt: string) => void;
  suggestion: HomePromptSuggestion;
}) {
  const prefersReducedMotion = useReducedMotion() === true;

  return (
    <Box
      component="button"
      type="button"
      disabled={disabled}
      onClick={() => onSelect(suggestion.prompt)}
      sx={{
        p: 2,
        minHeight: 88,
        borderRadius: "var(--joy-radius-xl)",
        border: "1px solid",
        borderColor: "neutral.outlinedBorder",
        backgroundColor: "background.surface",
        color: "inherit",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        fontFamily: "inherit",
        gap: 0.5,
        textAlign: "left",
        transition: prefersReducedMotion ? "none" : "all 180ms ease",
        width: "100%",
        "&:hover:not(:disabled)": {
          backgroundColor: "primary.softBg",
          borderColor: "primary.300",
          boxShadow: "sm",
          transform: prefersReducedMotion ? "none" : "translateY(-1px)",
        },
        "&:disabled": {
          cursor: "not-allowed",
          opacity: 0.5,
        },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.400",
          outlineOffset: "2px",
        },
      }}
    >
      {suggestion.categoryLabel ? (
        <Typography
          sx={{
            color: "primary.600",
            fontSize: "10px",
            fontWeight: 500,
            letterSpacing: "0.08em",
            lineHeight: 1.4,
            mb: 0.25,
            textTransform: "uppercase",
          }}
        >
          {suggestion.categoryLabel}
        </Typography>
      ) : null}
      <Typography
        sx={{
          color: "neutral.800",
          fontSize: "14px",
          fontWeight: 500,
          lineHeight: 1.4,
          overflowWrap: "anywhere",
        }}
      >
        {suggestion.displayText}
      </Typography>
    </Box>
  );
}

function SnapshotSkeleton() {
  const prefersReducedMotion = useReducedMotion() === true;

  return (
    <Box
      sx={{
        borderRadius: "var(--joy-radius-2xl)",
        border: "1px solid",
        borderColor: "neutral.outlinedBorder",
        backgroundColor: "background.surface",
        display: "flex",
        flexDirection: "column",
        gap: 2.5,
        p: { xs: 2.5, sm: 3 },
        width: "100%",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ color: "neutral.500", display: "inline-flex" }}>
          <BarChart3 size={15} strokeWidth={1.8} aria-hidden="true" />
        </Box>
        <Typography
          sx={{
            color: "neutral.600",
            fontSize: "12.5px",
            fontWeight: 500,
            letterSpacing: "0.01em",
            lineHeight: 1.4,
          }}
        >
          Today&apos;s snapshot
        </Typography>
      </Box>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 2.5, sm: 0 },
          gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
        }}
      >
        {[0, 1, 2, 3].map((item) => (
          <Box
            key={item}
            sx={{
              borderColor: "neutral.outlinedBorder",
              borderLeft: {
                xs: "none",
                sm: item === 0 ? "none" : "1px solid",
              },
              px: { xs: 0, sm: 2.5 },
            }}
          >
            <Skeleton
              animation={prefersReducedMotion ? false : "pulse"}
              variant="text"
              width="60%"
              sx={{ height: 28, mb: 0.5 }}
            />
            <Skeleton
              animation={prefersReducedMotion ? false : "pulse"}
              variant="text"
              width="80%"
              sx={{ height: 14 }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function HomeShellSkeleton() {
  const prefersReducedMotion = useReducedMotion() === true;

  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        mx: "auto",
        px: { xs: 3, sm: 5, md: 6 },
        py: { xs: 5, sm: 7 },
        width: "100%",
        maxWidth: 920,
      }}
    >
      <Box sx={{ textAlign: "center", mb: { xs: 6, sm: 7 } }}>
        <Skeleton
          animation={prefersReducedMotion ? false : "pulse"}
          variant="circular"
          sx={{ width: 72, height: 72, mx: "auto", mb: 3 }}
        />
        <Skeleton
          animation={prefersReducedMotion ? false : "pulse"}
          variant="text"
          sx={{ width: { xs: 220, sm: 300 }, height: 38, mx: "auto" }}
        />
        <Skeleton
          animation={prefersReducedMotion ? false : "pulse"}
          variant="text"
          sx={{ width: { xs: 180, sm: 240 }, height: 20, mx: "auto" }}
        />
      </Box>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          maxWidth: 620,
          width: "100%",
        }}
      >
        {promptCardSkeletons.map((item) => (
          <PromptCardSkeleton key={item} />
        ))}
      </Box>
    </Box>
  );
}

function StageZeroWelcomeCard({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (prompt: string) => void;
}) {
  const prefersReducedMotion = useReducedMotion() === true;
  const containerVariants = getMotionContainerVariants(0.15);
  const itemVariants = getMotionItemVariants(prefersReducedMotion);

  return (
    <Box
      sx={{
        position: "relative",
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minHeight: "100%",
        mx: "auto",
        px: { xs: 3, sm: 5, md: 6 },
        py: { xs: 5, sm: 7 },
        width: "100%",
        maxWidth: 920,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 600px 400px at 50% 0%, var(--joy-palette-primary-softBg) 0%, transparent 70%)",
          opacity: 0.4,
          zIndex: 0,
        },
      }}
    >
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          width: "100%",
          zIndex: 1,
        }}
      >
        <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
          <BloomAvatar size="xl" animate />
        </motion.div>

        <motion.div variants={itemVariants} style={{ width: "100%" }}>
          <Typography
            level="h1"
            sx={{
              color: "neutral.800",
              fontSize: { xs: "26px", sm: "30px", md: "32px" },
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              mb: 1.5,
              textAlign: "center",
            }}
          >
            Welcome to Bloom
          </Typography>
        </motion.div>

        <motion.div variants={itemVariants} style={{ width: "100%" }}>
          <Typography
            sx={{
              color: "neutral.500",
              fontSize: "16px",
              fontWeight: 400,
              lineHeight: 1.5,
              maxWidth: 480,
              mb: { xs: 6, sm: 7 },
              mx: "auto",
              textAlign: "center",
            }}
          >
            Your intelligent business companion
          </Typography>
        </motion.div>

        <motion.div variants={itemVariants} style={{ width: "100%" }}>
          <Box sx={{ mb: 2.5, textAlign: "center" }}>
            <SectionLabel>Here&apos;s what I can help you with</SectionLabel>
          </Box>
        </motion.div>

        <motion.div variants={itemVariants} style={{ width: "100%" }}>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
              mb: { xs: 6, sm: 7 },
              width: "100%",
            }}
          >
            {capabilityCards.map(({ description, Icon, title }) => (
              <Box
                key={title}
                sx={{
                  alignItems: "flex-start",
                  backgroundColor: "background.surface",
                  border: "1px solid",
                  borderColor: "neutral.outlinedBorder",
                  borderRadius: "var(--joy-radius-xl)",
                  boxShadow: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  p: 2.5,
                  transition: prefersReducedMotion ? "none" : "all 200ms ease",
                  "&:hover": {
                    borderColor: "primary.300",
                    boxShadow: "sm",
                    transform: prefersReducedMotion
                      ? "none"
                      : "translateY(-2px)",
                  },
                }}
              >
                <Box
                  sx={{
                    alignItems: "center",
                    backgroundColor: "primary.softBg",
                    borderRadius: "var(--joy-radius-lg)",
                    color: "primary.600",
                    display: "flex",
                    height: 36,
                    justifyContent: "center",
                    mb: 0.5,
                    width: 36,
                  }}
                >
                  <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                </Box>
                <Typography
                  sx={{
                    color: "neutral.800",
                    fontSize: "14px",
                    fontWeight: 500,
                    lineHeight: 1.35,
                  }}
                >
                  {title}
                </Typography>
                <Typography
                  sx={{
                    color: "neutral.500",
                    fontSize: "12.5px",
                    fontWeight: 400,
                    lineHeight: 1.5,
                  }}
                >
                  {description}
                </Typography>
              </Box>
            ))}
          </Box>
        </motion.div>

        <motion.div variants={itemVariants} style={{ width: "100%" }}>
          <Box sx={{ mb: 2.5, textAlign: "center" }}>
            <SectionLabel>Try one of these to get started</SectionLabel>
          </Box>
        </motion.div>

        <motion.div variants={itemVariants} style={{ width: "100%" }}>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              maxWidth: 620,
              mx: "auto",
              width: "100%",
            }}
          >
            {STARTER_PROMPTS.map((prompt) => (
              <Box
                key={prompt}
                component="button"
                type="button"
                disabled={disabled}
                onClick={() => onSelect(prompt)}
                sx={{
                  alignItems: "center",
                  backgroundColor: "background.surface",
                  border: "1px solid",
                  borderColor: "neutral.outlinedBorder",
                  borderRadius: "var(--joy-radius-xl)",
                  color: "inherit",
                  cursor: "pointer",
                  display: "flex",
                  fontFamily: "inherit",
                  gap: 2,
                  justifyContent: "space-between",
                  p: 2.25,
                  pl: 2.5,
                  pr: 2.25,
                  textAlign: "left",
                  transition: prefersReducedMotion
                    ? "none"
                    : "all 200ms cubic-bezier(0.2, 0, 0, 1)",
                  "&:hover:not(:disabled)": {
                    backgroundColor: "primary.softBg",
                    borderColor: "primary.400",
                    transform: prefersReducedMotion
                      ? "none"
                      : "translateX(2px)",
                    "& .starterArrow": {
                      color: "var(--joy-palette-primary-600)",
                      transform: prefersReducedMotion
                        ? "none"
                        : "translateX(2px)",
                    },
                  },
                  "&:disabled": {
                    cursor: "not-allowed",
                    opacity: 0.5,
                  },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.400",
                    outlineOffset: "2px",
                  },
                }}
              >
                <Typography
                  sx={{
                    color: "neutral.800",
                    fontSize: "14px",
                    fontWeight: 500,
                    lineHeight: 1.4,
                    overflowWrap: "anywhere",
                  }}
                >
                  {prompt}
                </Typography>
                <Box
                  className="starterArrow"
                  sx={{
                    color: "neutral.400",
                    display: "inline-flex",
                    flexShrink: 0,
                    transition: prefersReducedMotion
                      ? "none"
                      : "all 200ms ease",
                  }}
                >
                  <ArrowRight size={16} strokeWidth={1.9} aria-hidden="true" />
                </Box>
              </Box>
            ))}
          </Box>
        </motion.div>
      </motion.div>
    </Box>
  );
}

function SnapshotMetric({
  isFirst,
  label,
  value,
}: {
  isFirst: boolean;
  label: string;
  value: string;
}) {
  return (
    <Box
      sx={{
        borderColor: "neutral.outlinedBorder",
        borderLeft: { xs: "none", sm: isFirst ? "none" : "1px solid" },
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        px: { xs: 0, sm: 2.5 },
      }}
    >
      <Typography
        sx={{
          color: "neutral.800",
          fontSize: { xs: "22px", sm: "26px" },
          fontVariantNumeric: "tabular-nums",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          lineHeight: 1.1,
        }}
      >
        {value}
      </Typography>
      <Typography
        sx={{
          color: "neutral.500",
          fontSize: "12px",
          fontWeight: 400,
          lineHeight: 1.4,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function DailySnapshotCard({
  disabled,
  onSelect,
  snapshot,
}: {
  disabled: boolean;
  onSelect: () => void;
  snapshot: DailySnapshot;
}) {
  const prefersReducedMotion = useReducedMotion() === true;
  const hasData = hasSnapshotActivity(snapshot);
  const metrics = [
    { label: "Revenue today", value: formatCurrency(snapshot.revenueToday) },
    {
      label: "New customers",
      value: `+${formatInteger(snapshot.newCustomersToday)}`,
    },
    {
      label: "Active campaigns",
      value: formatInteger(snapshot.activeCampaignsCount),
    },
    {
      label: "Pending orders",
      value: formatInteger(snapshot.pendingOrdersCount),
    },
  ] as const;

  const content = (
    <>
      <Box sx={{ alignItems: "center", display: "flex", gap: 1 }}>
        <Box sx={{ color: "neutral.500", display: "inline-flex" }}>
          <BarChart3 size={15} strokeWidth={1.8} aria-hidden="true" />
        </Box>
        <Typography
          sx={{
            color: "neutral.600",
            fontSize: "12.5px",
            fontWeight: 500,
            letterSpacing: "0.01em",
            lineHeight: 1.4,
          }}
        >
          Today&apos;s snapshot
        </Typography>
      </Box>

      {hasData ? (
        <Box
          sx={{
            display: "grid",
            gap: { xs: 2.5, sm: 0 },
            gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
          }}
        >
          {metrics.map((metric, index) => (
            <SnapshotMetric
              key={metric.label}
              isFirst={index === 0}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </Box>
      ) : (
        <Typography
          sx={{
            color: "neutral.400",
            fontSize: "13px",
            fontStyle: "italic",
            fontWeight: 400,
            lineHeight: 1.5,
            py: 2,
            textAlign: "center",
          }}
        >
          No activity yet today
        </Typography>
      )}
    </>
  );

  const cardSx = {
    borderRadius: "var(--joy-radius-2xl)",
    border: "1px solid",
    borderColor: "neutral.outlinedBorder",
    backgroundColor: "background.surface",
    boxShadow: "none",
    cursor: hasData ? "pointer" : "default",
    display: "flex",
    flexDirection: "column",
    fontFamily: "inherit",
    gap: 2.5,
    p: { xs: 2.5, sm: 3 },
    textAlign: "left",
    transition: prefersReducedMotion ? "none" : "all 200ms ease",
    width: "100%",
    "&:hover:not(:disabled)": hasData
      ? {
          borderColor: "primary.300",
          boxShadow: "sm",
        }
      : undefined,
    "&:disabled": {
      cursor: "not-allowed",
      opacity: 0.5,
    },
    "&:focus-visible": {
      outline: "2px solid",
      outlineColor: "primary.400",
      outlineOffset: "2px",
    },
  };

  if (!hasData) {
    return <Box sx={cardSx}>{content}</Box>;
  }

  return (
    <Box
      component="button"
      type="button"
      disabled={disabled}
      onClick={onSelect}
      sx={cardSx}
    >
      {content}
    </Box>
  );
}

function BloomInsightsHomeSection({
  itemVariants,
}: {
  itemVariants: Variants;
}) {
  const { tenant, loading: tenantLoading } = useTenant();
  const { data: insights, isLoading } = useBloomInsights(tenant?.id);
  const showLoading = tenantLoading || (Boolean(tenant?.id) && isLoading);
  const showSection = showLoading || insights.length > 0;

  if (!showSection) {
    return null;
  }

  return (
    <motion.div variants={itemVariants} style={{ width: "100%" }}>
      <Box
        sx={{
          width: "100%",
          "& > .MuiStack-root": { width: "100%" },
          "& > .MuiStack-root > .MuiTypography-root:first-of-type": {
            display: "none",
          },
        }}
      >
        {!showLoading ? (
          <Box
            sx={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
              mb: 1.5,
            }}
          >
            <SectionLabel>Insights for today</SectionLabel>
          </Box>
        ) : null}
        <BloomInsightsSection />
      </Box>
    </motion.div>
  );
}

function ReturningHomeContent({
  disabled,
  displayedSuggestions,
  formattedDate,
  greeting,
  isUnpinningEntity,
  onPinnedContextSelect,
  onPinnedContextUnpin,
  onSelect,
  pinnedContext,
  showSnapshot,
  showSnapshotSkeleton,
  showSuggestionSkeletons,
  snapshot,
}: {
  disabled: boolean;
  displayedSuggestions: HomePromptSuggestion[];
  formattedDate: string;
  greeting: string;
  isUnpinningEntity: boolean;
  onPinnedContextSelect: (
    entityType: BloomPageEntityType,
    displayName: string,
  ) => void;
  onPinnedContextUnpin: (
    entityType: BloomPageEntityType,
    entityId: string,
  ) => void;
  onSelect: (prompt: string) => void;
  pinnedContext: BloomWorkspaceMemoryPinnedEntity[];
  showSnapshot: boolean;
  showSnapshotSkeleton: boolean;
  showSuggestionSkeletons: boolean;
  snapshot: DailySnapshot;
}) {
  const prefersReducedMotion = useReducedMotion() === true;
  const containerVariants = getMotionContainerVariants(0.1);
  const itemVariants = getMotionItemVariants(prefersReducedMotion);
  const showSuggestions =
    showSuggestionSkeletons || displayedSuggestions.length > 0;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: { xs: 4, sm: 5 },
        minHeight: "100%",
        mx: "auto",
        px: { xs: 3, sm: 5, md: 6 },
        py: { xs: 4, sm: 5 },
        width: "100%",
        maxWidth: 920,
      }}
    >
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        style={{ width: "100%" }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: { xs: 4, sm: 5 },
            width: "100%",
          }}
        >
          <motion.div variants={itemVariants} style={{ width: "100%" }}>
            <Box>
              <Typography
                sx={{
                  color: "neutral.800",
                  fontSize: { xs: "22px", sm: "28px" },
                  fontWeight: 500,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.2,
                  mb: 0.5,
                }}
              >
                {greeting}
              </Typography>
              <Typography
                sx={{
                  color: "neutral.500",
                  fontSize: "14px",
                  fontWeight: 400,
                  lineHeight: 1.5,
                }}
              >
                {formattedDate}
              </Typography>
            </Box>
          </motion.div>

          {showSnapshotSkeleton ? (
            <motion.div variants={itemVariants} style={{ width: "100%" }}>
              <SnapshotSkeleton />
            </motion.div>
          ) : null}

          {showSnapshot ? (
            <motion.div variants={itemVariants} style={{ width: "100%" }}>
              <DailySnapshotCard
                disabled={disabled}
                snapshot={snapshot}
                onSelect={() => onSelect(snapshotPrompt)}
              />
            </motion.div>
          ) : null}

          <BloomInsightsHomeSection itemVariants={itemVariants} />

          {showSuggestions ? (
            <motion.div variants={itemVariants} style={{ width: "100%" }}>
              <Box>
                {!showSuggestionSkeletons ? (
                  <Box sx={{ mb: 1.5 }}>
                    <SectionLabel>Suggested for you</SectionLabel>
                  </Box>
                ) : null}

                <Box
                  sx={{
                    display: "grid",
                    gap: 1.5,
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "1fr 1fr",
                      md: "1fr 1fr 1fr",
                    },
                  }}
                >
                  {showSuggestionSkeletons
                    ? promptCardSkeletons.map((item) => (
                        <PromptCardSkeleton key={item} />
                      ))
                    : displayedSuggestions
                        .slice(0, 6)
                        .map((suggestion) => (
                          <PromptCard
                            key={suggestion.prompt}
                            disabled={disabled}
                            suggestion={suggestion}
                            onSelect={onSelect}
                          />
                        ))}
                </Box>
              </Box>
            </motion.div>
          ) : null}

          {pinnedContext.length > 0 ? (
            <motion.div variants={itemVariants} style={{ width: "100%" }}>
              <Box>
                <Box
                  sx={{
                    alignItems: "center",
                    display: "flex",
                    gap: 1,
                    mb: 1.5,
                  }}
                >
                  <Box sx={{ color: "neutral.500", display: "inline-flex" }}>
                    <Pin size={13} strokeWidth={1.9} aria-hidden="true" />
                  </Box>
                  <SectionLabel>Pinned</SectionLabel>
                </Box>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {pinnedContext.map((entry) => {
                    const meta = pinnedEntityMeta[entry.entityType];

                    return (
                      <JoyChip
                        key={`${entry.entityType}:${entry.entityId}`}
                        color="neutral"
                        disabled={disabled || isUnpinningEntity}
                        size="md"
                        variant="soft"
                        title={`${meta.label}: ${entry.displayName}`}
                        startDecorator={
                          <meta.Icon
                            size={12}
                            strokeWidth={1.9}
                            aria-hidden="true"
                          />
                        }
                        onClick={() =>
                          onPinnedContextSelect(
                            entry.entityType,
                            entry.displayName,
                          )
                        }
                        endDecorator={
                          <Box
                            component="button"
                            type="button"
                            aria-label={`Unpin ${entry.displayName}`}
                            disabled={disabled || isUnpinningEntity}
                            onMouseDown={(
                              event: React.MouseEvent<HTMLButtonElement>,
                            ) => {
                              event.stopPropagation();
                            }}
                            onClick={(
                              event: React.MouseEvent<HTMLButtonElement>,
                            ) => {
                              event.stopPropagation();
                              onPinnedContextUnpin(
                                entry.entityType,
                                entry.entityId,
                              );
                            }}
                            sx={{
                              alignItems: "center",
                              backgroundColor: "inherit",
                              border: 0,
                              borderRadius: "var(--joy-radius-lg)",
                              color: "inherit",
                              cursor:
                                disabled || isUnpinningEntity
                                  ? "not-allowed"
                                  : "pointer",
                              display: "inline-flex",
                              height: 18,
                              justifyContent: "center",
                              m: 0,
                              p: 0,
                              width: 18,
                              "&:focus-visible": {
                                outline: "2px solid",
                                outlineColor: "primary.400",
                                outlineOffset: "1px",
                              },
                            }}
                          >
                            <X size={12} strokeWidth={2} aria-hidden="true" />
                          </Box>
                        }
                        sx={{
                          borderRadius: "var(--joy-radius-2xl)",
                          cursor: disabled ? "not-allowed" : "pointer",
                          maxWidth: "100%",
                          px: 1.5,
                          "&:hover": {
                            backgroundColor: disabled
                              ? "background.surface"
                              : "primary.softBg",
                            color: disabled ? "neutral.800" : "primary.700",
                          },
                        }}
                      >
                        <Typography
                          noWrap
                          sx={{
                            color: "inherit",
                            fontSize: "13px",
                            fontWeight: 500,
                            lineHeight: 1.4,
                            maxWidth: { xs: 164, sm: 220 },
                          }}
                        >
                          {entry.displayName}
                        </Typography>
                      </JoyChip>
                    );
                  })}
                </Box>
              </Box>
            </motion.div>
          ) : null}
        </Box>
      </motion.div>
    </Box>
  );
}

interface BloomHomeStateProps {
  prioritizePageContext?: boolean;
}

export function BloomHomeState({
  prioritizePageContext = true,
}: BloomHomeStateProps) {
  const { stage: onboardingStage } = useBloomOnboarding();
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const profileQuery = useBloomProfile();
  const { isUnpinningEntity, unpinEntity } = useBloomProfileMutations();
  const {
    entitySummary,
    entitySummaryLoading,
    sendMessage,
    isStreaming,
    pageContext,
  } = useBloom();
  const [homeTimeContext] = React.useState(getHomeTimeContext);
  const displayName = getDisplayName(user?.user_metadata, user?.email);
  const workspaceMemory = React.useMemo(() => {
    const rawWorkspaceMemory = profileQuery.data?.workspaceMemory;
    return rawWorkspaceMemory
      ? normalizeBloomWorkspaceMemory(rawWorkspaceMemory)
      : null;
  }, [profileQuery.data?.workspaceMemory]);
  const pinnedContext = React.useMemo(
    () => workspaceMemory?.pinnedContext ?? [],
    [workspaceMemory],
  );
  const suggestions = useBloomSuggestions(
    prioritizePageContext ? pageContext : null,
    workspaceMemory,
    tenant?.id,
  );
  const snapshotQuery = useBloomDailySnapshot(tenant?.id);
  const hasEntityContext = Boolean(
    pageContext?.entityType && pageContext.entityId,
  );
  const genericSuggestions = React.useMemo<HomePromptSuggestion[]>(
    () =>
      suggestions.data.map((suggestion) => ({
        categoryLabel: suggestionCategoryLabels[suggestion.category],
        displayText: suggestion.prompt,
        prompt: suggestion.prompt,
      })),
    [suggestions.data],
  );
  const entitySuggestions = React.useMemo<HomePromptSuggestion[] | null>(() => {
    if (!entitySummary) {
      return null;
    }

    return ENTITY_PROMPT_BLUEPRINTS[entitySummary.entityType].map(
      (blueprint) => ({
        categoryLabel: entityCategoryLabels[entitySummary.entityType],
        displayText: blueprint.label,
        prompt: blueprint.buildPrompt(entitySummary),
      }),
    );
  }, [entitySummary]);
  const displayedSuggestions = entitySuggestions ?? genericSuggestions;
  const showSuggestionSkeletons =
    tenantLoading ||
    (hasEntityContext
      ? entitySummaryLoading || (!entitySummary && suggestions.isLoading)
      : suggestions.isLoading);
  const showSnapshotSkeleton =
    tenantLoading || (Boolean(tenant?.id) && snapshotQuery.isLoading);
  const showSnapshot =
    !showSnapshotSkeleton && Boolean(tenant?.id) && !snapshotQuery.isError;
  const showHomeShellSkeleton =
    profileQuery.isLoading && profileQuery.data === undefined;

  const submitPrompt = React.useCallback(
    (prompt: string) => {
      void sendMessage(prompt).catch(() => undefined);
    },
    [sendMessage],
  );

  const handlePinnedContextSelect = React.useCallback(
    (entityType: BloomPageEntityType, entityDisplayName: string) => {
      if (isStreaming) {
        return;
      }

      submitPrompt(`Tell me about ${entityType} ${entityDisplayName}`);
    },
    [isStreaming, submitPrompt],
  );

  const handlePinnedContextUnpin = React.useCallback(
    (entityType: BloomPageEntityType, entityId: string) => {
      if (isUnpinningEntity) {
        return;
      }

      void unpinEntity(entityType, entityId).catch(() => undefined);
    },
    [isUnpinningEntity, unpinEntity],
  );

  if (showHomeShellSkeleton) {
    return (
      <HomeScrollContainer>
        <HomeShellSkeleton />
      </HomeScrollContainer>
    );
  }

  if (
    onboardingStage === 0 &&
    !(profileQuery.isLoading && profileQuery.data === undefined)
  ) {
    return (
      <HomeScrollContainer>
        <StageZeroWelcomeCard disabled={isStreaming} onSelect={submitPrompt} />
      </HomeScrollContainer>
    );
  }

  return (
    <HomeScrollContainer>
      <ReturningHomeContent
        disabled={isStreaming}
        displayedSuggestions={displayedSuggestions}
        formattedDate={homeTimeContext.formattedDate}
        greeting={`${homeTimeContext.greeting}, ${displayName}`}
        isUnpinningEntity={isUnpinningEntity}
        onPinnedContextSelect={handlePinnedContextSelect}
        onPinnedContextUnpin={handlePinnedContextUnpin}
        onSelect={submitPrompt}
        pinnedContext={pinnedContext}
        showSnapshot={showSnapshot}
        showSnapshotSkeleton={showSnapshotSkeleton}
        showSuggestionSkeletons={showSuggestionSkeletons}
        snapshot={snapshotQuery.data}
      />
    </HomeScrollContainer>
  );
}
