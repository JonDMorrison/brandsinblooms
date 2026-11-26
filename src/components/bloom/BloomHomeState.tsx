import * as React from "react";
import Box from "@mui/joy/Box";
import Skeleton from "@mui/joy/Skeleton";
import Typography from "@mui/joy/Typography";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  BarChart3,
  Layers,
  Mail,
  Package,
  Pin,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useBloom } from "@/components/bloom/BloomContext";
import { BloomInsightsSection } from "@/components/bloom/BloomInsightsSection";
import { BloomWelcome } from "@/components/bloom/BloomWelcome";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  useBloomDailySnapshot,
  type DailySnapshot,
} from "@/hooks/bloom/useBloomDailySnapshot";
import { useBloomInsights } from "@/hooks/bloom/useBloomInsights";
import { useBloomOnboarding } from "@/hooks/bloom/useBloomOnboarding";
import { useBloomProfile } from "@/hooks/bloom/useBloomProfile";
import { useBloomProfileMutations } from "@/hooks/bloom/useBloomProfileMutations";
import type { BloomPageEntityType } from "@/hooks/bloom/types";
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
const motionEase = [0.2, 0, 0, 1] as const;

const suggestionCategoryLabels: Record<BloomSuggestionCategory, string> = {
  analytics: "Analytics",
  business: "Business",
  campaign: "Marketing",
  customer: "Customers",
  product: "Inventory",
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

type HomePromptSuggestion = {
  categoryLabel?: string;
  displayText: string;
  prompt: string;
};

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
        pb: { xs: 4, sm: 5 },
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
  const { tenant, loading: tenantLoading } = useTenant();
  const profileQuery = useBloomProfile();
  const { isUnpinningEntity, unpinEntity } = useBloomProfileMutations();
  const { sendMessage, isStreaming, pageContext } = useBloom();
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
  const displayedSuggestions = React.useMemo<HomePromptSuggestion[]>(
    () =>
      suggestions.data.map((suggestion) => ({
        categoryLabel: suggestionCategoryLabels[suggestion.category],
        displayText: suggestion.prompt,
        prompt: suggestion.prompt,
      })),
    [suggestions.data],
  );
  const showSuggestionSkeletons = tenantLoading || suggestions.isLoading;
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

  // The welcome (greeting + starter questions) is the drawer's, so /bloom and
  // the drawer greet the same way. /bloom's wider canvas adds the snapshot,
  // insights, personalised suggestions and pinned context for returning users.
  const welcome = (
    <BloomWelcome
      disabled={isStreaming}
      layout="page"
      onSelectPrompt={submitPrompt}
      resourceFocus={null}
    />
  );

  if (onboardingStage === 0) {
    return <HomeScrollContainer>{welcome}</HomeScrollContainer>;
  }

  return (
    <HomeScrollContainer>
      {welcome}
      <ReturningHomeContent
        disabled={isStreaming}
        displayedSuggestions={displayedSuggestions}
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
