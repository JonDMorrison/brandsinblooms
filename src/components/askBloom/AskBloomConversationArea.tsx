import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import Link from "@mui/joy/Link";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { Theme } from "@mui/joy/styles";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  GitCompare,
  Info,
  Lightbulb,
  Mail,
  Package,
  PenLine,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Truck,
  User,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import { AskBloomActionCard } from "@/components/askBloom/AskBloomActionCard";
import { BloomAttachmentDisplay } from "@/components/bloom/BloomAttachmentDisplay";
import { ThinkingBlock } from "@/components/bloom/blocks/ThinkingBlock";
import { ContentBlockRenderer } from "@/components/bloom/content/ContentBlockRenderer";
import {
  contentBlockFromStreamingBlock,
  extractIdentifiersFromToolResults,
  stripRedundantContent,
  type BloomContentBlock,
} from "@/components/bloom/content/parseContentBlocks";
import { stripStreamingMarkdownTables } from "@/components/bloom/content/sanitizeBloomContent";
import {
  analyzeStreamingContent,
  detectFormRequest,
  extractPreFormText,
  gateLoaderMessage,
  isGlobalGateAction,
} from "@/components/bloom/utils/contentGate";
import { stripToolJsonFromText } from "@/components/bloom/utils/stripToolJson";
import { useAskBloomInsights } from "@/hooks/askBloom/useAskBloomInsights";
import { useAskBloom } from "@/providers/AskBloomProvider";
import bloomLogo from "@/assets/logos/bloom-logo.png";
import type {
  AskBloomActiveToolCall,
  AskBloomBlock,
  AskBloomInsight,
  AskBloomMessage,
} from "@/types/askBloom";
import { getAskBloomStarterConfig } from "@/utils/askBloomStarters";
import { humanizeAskBloomResourceType } from "@/utils/askBloomRouteContext";

const markdownStyles = {
  minWidth: 0,
  "& p": {
    margin: "0 0 10px 0",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "text.primary",
    "&:last-child": { marginBottom: 0 },
  },
  "& strong, & b": {
    fontWeight: 700,
    color: "text.primary",
  },
  "& em, & i": {
    fontStyle: "italic",
  },
  "& a": {
    color: "primary.plainColor",
    textDecoration: "underline",
    textDecorationColor: "var(--joy-palette-primary-300)",
    textUnderlineOffset: "2px",
    cursor: "pointer",
    fontWeight: 500,
    "&:hover": {
      textDecorationColor: "var(--joy-palette-primary-plainColor)",
    },
  },
  '& a[href*="blocked"]': {
    color: "text.tertiary",
    textDecoration: "underline",
    cursor: "not-allowed",
  },
  "& code": {
    fontFamily: "var(--joy-fontFamily-code, monospace)",
    fontSize: "12.5px",
    fontWeight: 500,
    backgroundColor: "neutral.softBg",
    color: "text.primary",
    padding: "1.5px 5px",
    borderRadius: "4px",
    border: "1px solid",
    borderColor: "neutral.outlinedBorder",
    whiteSpace: "nowrap",
  },
  "& pre": {
    margin: "10px 0",
    padding: "12px 14px",
    backgroundColor: "neutral.softBg",
    borderRadius: "6px",
    border: "1px solid",
    borderColor: "neutral.outlinedBorder",
    overflowX: "auto",
    "& code": {
      backgroundColor: "transparent",
      border: "none",
      padding: 0,
      fontSize: "12.5px",
      lineHeight: 1.6,
      whiteSpace: "pre",
    },
  },
  "& ol": {
    margin: "8px 0",
    paddingLeft: "22px",
    listStyleType: "decimal",
    "& li": {
      marginBottom: "6px",
      fontSize: "14px",
      lineHeight: 1.6,
      paddingLeft: "4px",
      color: "text.primary",
      "&::marker": {
        color: "text.tertiary",
        fontWeight: 500,
      },
    },
  },
  "& ul": {
    margin: "8px 0",
    paddingLeft: "22px",
    listStyleType: "disc",
    "& li": {
      marginBottom: "6px",
      fontSize: "14px",
      lineHeight: 1.6,
      paddingLeft: "4px",
      color: "text.primary",
      "&::marker": {
        color: "text.tertiary",
      },
    },
  },
  "& hr": {
    margin: "12px 0",
    border: "none",
    borderTop: "1px solid",
    borderColor: "divider",
  },
  "& h1, & h2, & h3, & h4": {
    fontWeight: 700,
    color: "text.primary",
    margin: "14px 0 8px 0",
    lineHeight: 1.3,
    "&:first-of-type": { marginTop: 0 },
  },
  "& h1": { fontSize: "18px" },
  "& h2": { fontSize: "16px" },
  "& h3": { fontSize: "15px" },
  "& h4": { fontSize: "14px" },
  "& blockquote": {
    margin: "10px 0",
    padding: "8px 14px",
    borderLeft: "3px solid",
    borderColor: "neutral.outlinedBorder",
    backgroundColor: "background.level1",
    borderRadius: "0 6px 6px 0",
    "& p": {
      margin: 0,
      color: "text.secondary",
      fontStyle: "italic",
    },
  },
  "& table": {
    display: "block",
    width: "max-content",
    minWidth: "100%",
    maxWidth: "100%",
    overflowX: "auto",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    margin: "10px 0",
    fontSize: "13px",
    "& th": {
      textAlign: "left",
      fontWeight: 600,
      padding: "6px 10px",
      width: "160px",
      minWidth: "160px",
      borderBottom: "2px solid",
      borderColor: "divider",
      color: "text.secondary",
      whiteSpace: "normal",
      overflowWrap: "anywhere",
      verticalAlign: "top",
    },
    "& td": {
      padding: "6px 10px",
      width: "160px",
      minWidth: "160px",
      borderBottom: "1px solid",
      borderColor: "divider",
      color: "text.primary",
      whiteSpace: "normal",
      overflowWrap: "anywhere",
      verticalAlign: "top",
    },
  },
} as const;

const blockDividerSx = {
  marginTop: "12px",
  paddingTop: "12px",
  borderTop: "1px solid",
  borderColor: "divider",
} as const;

/**
 * Wrapper for Bloom's structured/tool-result blocks inside the narrow Ask Bloom
 * panel (320–600px). Bloom blocks are already built defensively (`minmax(0, 1fr)`
 * grids, `minWidth: 0` flex/grid children, `noWrap`/`overflowWrap` text), so they
 * shrink to fit. This adds backstops so the genuinely-wide children scroll or
 * constrain internally instead of forcing the conversation column to overflow:
 * - `minWidth: 0` lets recharts `ResponsiveContainer` (ChartBlock) shrink below
 *   its initial render width.
 * - Table blocks own their own horizontal scroll container; this wrapper avoids
 *   overriding table display/layout so fixed-width columns can size correctly.
 * - `& pre` keeps code blocks scrollable.
 * - `& img` / recharts width caps keep images and charts inside the panel.
 * Applied here in Ask Bloom — never in Bloom's shared block source.
 */
const structuredBlockWrapperSx = {
  ...blockDividerSx,
  minWidth: 0,
  maxWidth: "100%",
  "& pre": {
    overflowX: "auto",
    maxWidth: "100%",
  },
  "& img": {
    maxWidth: "100%",
    height: "auto",
  },
  "& .recharts-responsive-container": {
    maxWidth: "100%",
  },
} as const;

const STARTER_ICON_MAP: Record<string, LucideIcon> = {
  BarChart3,
  Clock,
  FileText,
  GitCompare,
  Lightbulb,
  Mail,
  Package,
  PenLine,
  Search,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Truck,
  User,
  Users,
};

const INSIGHT_PRIORITY: Record<AskBloomInsight["type"], number> = {
  warning: 0,
  action: 1,
  positive: 2,
  info: 3,
};

const floatingComposerPadding =
  "calc(var(--ask-bloom-floating-stack-height, var(--ask-bloom-floating-input-height, 0px)) + 20px)";

const floatingScrollButtonBottom =
  "calc(var(--ask-bloom-floating-stack-height, var(--ask-bloom-floating-input-height, 0px)) + 28px)";

const ASK_BLOOM_EVIDENCE_LATCH_MS = 2000;

const hiddenScrollbarSx = {
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  "&::-webkit-scrollbar": {
    display: "none",
  },
} as const;

function StarterIcon({ name }: { name: string }) {
  const Icon = STARTER_ICON_MAP[name] ?? Sparkles;
  return <Icon aria-hidden="true" size={15} strokeWidth={1.8} />;
}

function InsightIcon({ type }: { type: AskBloomInsight["type"] }) {
  const iconByType: Record<AskBloomInsight["type"], LucideIcon> = {
    warning: AlertTriangle,
    positive: TrendingUp,
    info: Info,
    action: Zap,
  };
  const colorByType: Record<AskBloomInsight["type"], string> = {
    warning: "warning.500",
    positive: "success.500",
    info: "primary.500",
    action: "warning.600",
  };
  const Icon = iconByType[type];

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: colorByType[type],
        flexShrink: 0,
      }}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
    </Box>
  );
}

function WelcomeBloomLogo() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: 92,
        height: 92,
        mx: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        filter:
          "drop-shadow(0 12px 22px rgba(var(--joy-palette-primary-mainChannel) / 0.18))",
      }}
    >
      <Box
        component="img"
        src={bloomLogo}
        alt=""
        draggable={false}
        sx={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "contain",
          userSelect: "none",
        }}
      />
    </Box>
  );
}

/**
 * Guards Bloom's content renderers, which can throw when a block type depends on
 * `BloomProvider` (e.g. `task_plan` calls `useBloom()`). Ask Bloom renders
 * outside that provider, so a single bad block must not crash the panel.
 */
class AskBloomBlockBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Ask Bloom failed to render a content block", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={blockDividerSx}>
          <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
            This result can't be displayed here.
          </Typography>
        </Box>
      );
    }

    return this.props.children;
  }
}

/**
 * Converts an Ask Bloom block into the Bloom content-block shape consumed by
 * `ContentBlockRenderer`. Streaming blocks already carry the original Bloom
 * block (see M01); persisted blocks are synthesized from their stored type and
 * payload so they route through the same renderer pipeline.
 */
const toBloomContentBlock = (block: AskBloomBlock): BloomContentBlock => {
  if (block.bloomContentBlock) {
    return block.bloomContentBlock;
  }

  const fallbackId = block.id ?? block.type;

  if (block.type === "thinking") {
    return { type: "thinking", id: fallbackId, content: block.content };
  }

  if (block.type === "tool_result") {
    const toolResult = block.toolResult;
    const trimmedContent = block.content.trim();
    return {
      type: "tool_result",
      id: fallbackId,
      toolName: toolResult?.toolName ?? null,
      blockType: toolResult?.blockType ?? null,
      data: toolResult?.data ?? block.data,
      status: toolResult?.status ?? "success",
      message: toolResult?.message ?? (trimmedContent ? trimmedContent : null),
      error: toolResult?.error ?? null,
      count: toolResult?.count ?? null,
    };
  }

  return {
    type: "block",
    id: fallbackId,
    blockType: block.type,
    payload: block.data,
  };
};

type ToolResultContentBlock = Extract<
  BloomContentBlock,
  { type: "tool_result" }
>;

const isToolResultContentBlock = (
  block: BloomContentBlock,
): block is ToolResultContentBlock => block.type === "tool_result";

const mergeToolResultBlocks = (
  messageBlocks: ToolResultContentBlock[],
  streamingBlocks: ToolResultContentBlock[],
): ToolResultContentBlock[] => {
  const seen = new Set<string>();
  return [...messageBlocks, ...streamingBlocks].filter((block) => {
    if (seen.has(block.id)) {
      return false;
    }
    seen.add(block.id);
    return true;
  });
};

const renderStructuredBlock = (
  block: AskBloomBlock,
  messageId: string,
  onPromptClick: (prompt: string) => void,
  showSuggestionChips: boolean,
  onRetry: () => void,
) => {
  if (block.type === "text") {
    return (
      <Box sx={markdownStyles}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {block.content}
        </ReactMarkdown>
      </Box>
    );
  }

  if (block.type === "suggestion_chips") {
    if (!showSuggestionChips) {
      return null;
    }

    const suggestions = Array.isArray(block.data.suggestions)
      ? block.data.suggestions.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        )
      : [];

    if (suggestions.length === 0) {
      return null;
    }

    return (
      <Box
        key="suggestion-chips"
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          ...blockDividerSx,
        }}
      >
        {suggestions.map((suggestion) => (
          <Chip
            key={suggestion}
            size="sm"
            variant="outlined"
            color="neutral"
            onClick={() => onPromptClick(suggestion)}
            sx={{
              borderRadius: "xl",
              fontSize: "xs",
              fontWeight: 500,
              cursor: "pointer",
              "&:hover": {
                backgroundColor: "primary.softBg",
                borderColor: "primary.outlinedColor",
              },
            }}
          >
            {suggestion}
          </Chip>
        ))}
      </Box>
    );
  }

  if (block.type === "mutation_action") {
    // Pending actions are presented in the AskBloomApprovalBar above the input
    // (M03), not inline in the conversation. Executing/completed/failed cards
    // remain inline as progress / summary.
    if (block.status === "pending") {
      return null;
    }

    return (
      <Box key={block.mutationId} sx={blockDividerSx}>
        <AskBloomActionCard messageId={messageId} block={block} />
      </Box>
    );
  }

  return (
    <Box sx={structuredBlockWrapperSx}>
      <AskBloomBlockBoundary>
        <ContentBlockRenderer
          block={toBloomContentBlock(block)}
          onAction={onPromptClick}
          onRetry={onRetry}
        />
      </AskBloomBlockBoundary>
    </Box>
  );
};

function WelcomeState() {
  const askBloom = useAskBloom();
  const resourceFocus = askBloom.state.resourceFocus;
  const starterConfig = React.useMemo(
    () => getAskBloomStarterConfig(resourceFocus),
    [resourceFocus],
  );
  const { insights, isLoading } = useAskBloomInsights({
    resourceType: resourceFocus?.resourceType ?? null,
    resourceId: resourceFocus?.resourceId ?? null,
    enabled: Boolean(resourceFocus),
  });
  const visibleInsights = React.useMemo(
    () =>
      insights
        .slice()
        .sort((left, right) => {
          const priorityDifference =
            INSIGHT_PRIORITY[left.type] - INSIGHT_PRIORITY[right.type];
          if (priorityDifference !== 0) {
            return priorityDifference;
          }
          return left.title.localeCompare(right.title);
        })
        .slice(0, 3),
    [insights],
  );

  return (
    <Stack
      spacing={2.25}
      sx={{
        width: "100%",
        maxWidth: 292,
        mx: "auto",
        px: 0,
        py: 2,
      }}
    >
      <Stack spacing={1.25} sx={{ alignItems: "center", textAlign: "center" }}>
        <WelcomeBloomLogo />
        <Typography
          level="title-md"
          sx={{
            fontWeight: 700,
            letterSpacing: 0,
            color: "text.primary",
            lineHeight: 1.15,
          }}
        >
          {starterConfig.greeting}
        </Typography>
      </Stack>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
        }}
      >
        {starterConfig.starters.map((starter) => (
          <Button
            key={starter.label}
            color="neutral"
            variant="outlined"
            onClick={() => askBloom.sendMessage(starter.prompt)}
            sx={{
              "--Button-gap": "0px",
              width: "100%",
              minHeight: 50,
              px: 1,
              py: 0.85,
              justifyContent: "flex-start",
              textAlign: "left",
              borderRadius: "12px",
              borderColor: "neutral.outlinedBorder",
              bgcolor: "background.surface",
              boxShadow:
                "0 1px 0 rgba(var(--joy-palette-neutral-darkChannel) / 0.02)",
              overflow: "hidden",
              transition:
                "background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease",
              "&:hover": {
                bgcolor: "background.surface",
                borderColor: "primary.outlinedBorder",
                boxShadow:
                  "0 8px 24px rgba(var(--joy-palette-neutral-darkChannel) / 0.08)",
                transform: "translateY(-1px)",
              },
              "&:hover .AskBloomStarter-iconBox": {
                bgcolor: "primary.softBg",
                color: "primary.plainColor",
              },
              "&:hover .AskBloomStarter-title": {
                color: "primary.plainColor",
              },
              "&:hover .AskBloomStarter-description": {
                color: "primary.600",
              },
              "&:hover .AskBloomStarter-chevron": {
                color: "primary.plainColor",
                opacity: 1,
              },
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                width: "100%",
                minWidth: 0,
              }}
            >
              <Box
                className="AskBloomStarter-iconBox"
                sx={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: "9px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "background.level1",
                  color: "text.secondary",
                  transition: "background-color 150ms ease, color 150ms ease",
                }}
              >
                <StarterIcon name={starter.icon} />
              </Box>
              <Box
                component="div"
                sx={{
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <Typography
                  className="AskBloomStarter-title"
                  level="body-sm"
                  sx={{
                    textAlign: "left",
                    fontWeight: 700,
                    color: "text.primary",
                    fontSize: "0.75rem",
                    lineHeight: 1.2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {starter.label}
                </Typography>
                <Typography
                  className="AskBloomStarter-description"
                  level="body-xs"
                  sx={{
                    mt: 0.15,
                    textAlign: "left",
                    color: "text.secondary",
                    fontSize: "0.69rem",
                    lineHeight: 1.25,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    transition: "color 150ms ease",
                  }}
                >
                  {starter.description}
                </Typography>
              </Box>
              <Box
                className="AskBloomStarter-chevron"
                aria-hidden="true"
                sx={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  color: "text.tertiary",
                  opacity: 0.6,
                  transition: "color 150ms ease, opacity 150ms ease",
                }}
              >
                <ChevronRight size={16} strokeWidth={1.8} />
              </Box>
            </Box>
          </Button>
        ))}
      </Box>

      {resourceFocus ? (
        isLoading ? (
          <Stack spacing={1}>
            {Array.from({ length: 2 }).map((_, index) => (
              <Card
                key={`insight-skeleton-${index}`}
                variant="outlined"
                size="sm"
                sx={{ borderRadius: "10px", p: 1.25 }}
              >
                <Stack spacing={1}>
                  <Skeleton
                    variant="rectangular"
                    sx={{ height: 16, borderRadius: "sm" }}
                  />
                  <Skeleton
                    variant="rectangular"
                    sx={{ height: 12, borderRadius: "sm" }}
                  />
                  <Skeleton
                    variant="rectangular"
                    sx={{ height: 12, width: "70%", borderRadius: "sm" }}
                  />
                </Stack>
              </Card>
            ))}
          </Stack>
        ) : visibleInsights.length > 0 ? (
          <Stack spacing={1}>
            {visibleInsights.map((insight) => (
              <Card
                key={insight.id}
                variant="outlined"
                size="sm"
                sx={{ borderRadius: "10px", p: 1.25 }}
              >
                <Stack spacing={1}>
                  <Box
                    sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
                  >
                    <InsightIcon type={insight.type} />
                    <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                      <Typography level="title-sm" sx={{ fontWeight: 500 }}>
                        {insight.title}
                      </Typography>
                      <Typography
                        level="body-xs"
                        sx={{ color: "text.secondary" }}
                      >
                        {insight.body}
                      </Typography>
                    </Stack>
                  </Box>
                  {insight.suggestedPrompt ? (
                    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                      <Link
                        component="button"
                        type="button"
                        level="body-xs"
                        underline="none"
                        color="primary"
                        onClick={() =>
                          askBloom.sendMessage(insight.suggestedPrompt!)
                        }
                        sx={{ fontWeight: 500 }}
                      >
                        {"Ask about this ->"}
                      </Link>
                    </Box>
                  ) : null}
                </Stack>
              </Card>
            ))}
          </Stack>
        ) : null
      ) : null}
    </Stack>
  );
}

function LoadingState() {
  return (
    <Stack spacing={2} sx={{ px: 1, py: 2 }}>
      {Array.from({ length: 3 }).map((_, index) => {
        const isUser = index % 2 === 1;
        return (
          <Box
            key={index}
            sx={{
              display: "flex",
              justifyContent: isUser ? "flex-end" : "flex-start",
            }}
          >
            <Skeleton
              variant="rectangular"
              animation="wave"
              sx={{
                width: isUser ? "62%" : "72%",
                height: isUser ? 48 : 72,
                borderRadius: isUser
                  ? "12px 12px 4px 12px"
                  : "12px 12px 12px 4px",
              }}
            />
          </Box>
        );
      })}
    </Stack>
  );
}

function NavigationPromptCard() {
  const askBloom = useAskBloom();
  const navigationPrompt = askBloom.state.navigationPrompt;
  const currentResourceLabel =
    askBloom.state.resourceFocus?.resourceLabel?.trim() || "current focus";

  if (!navigationPrompt) {
    return null;
  }

  return (
    <Card
      variant="soft"
      color="primary"
      size="sm"
      sx={{
        mb: 1.5,
        borderRadius: "12px",
        p: 1.5,
        textAlign: "center",
      }}
    >
      <Stack spacing={1.25} alignItems="center">
        <Typography level="body-sm" sx={{ fontWeight: 500 }}>
          You navigated to a different{" "}
          {humanizeAskBloomResourceType(
            navigationPrompt.newResourceType,
          ).toLowerCase()}
          .
        </Typography>
        <Typography level="title-sm">
          Switch focus to {navigationPrompt.newResourceLabel}?
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          justifyContent="center"
          useFlexGap
          flexWrap="wrap"
        >
          <Button
            size="sm"
            variant="solid"
            onClick={askBloom.acceptNavigationPrompt}
          >
            Switch
          </Button>
          <Button
            size="sm"
            variant="plain"
            color="neutral"
            onClick={askBloom.dismissNavigationPrompt}
          >
            Keep {currentResourceLabel}
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}

type MessageFeedback = "liked" | "disliked";

const actionIconButtonSx = (active: boolean) =>
  ({
    minWidth: "28px",
    height: "28px",
    borderRadius: "sm",
    backgroundColor: "background.surface",
    color: "neutral.800",
    transition: "opacity 150ms ease, background-color 150ms ease",
    "& svg": {
      color: "var(--joy-palette-neutral-800)",
      stroke: "var(--joy-palette-neutral-800)",
    },
    "&:hover": {
      opacity: active ? 1 : 0.7,
      backgroundColor: "background.level1",
    },
  }) as const;

function MessageActionRow({
  message,
  isLatestMessage,
  feedback,
  onFeedback,
  isCopied,
  onCopy,
  onRegenerate,
}: {
  message: AskBloomMessage;
  isLatestMessage: boolean;
  feedback: MessageFeedback | null;
  onFeedback: (messageId: string, type: MessageFeedback) => void;
  isCopied: boolean;
  onCopy: (messageId: string, content: string) => void;
  onRegenerate: (messageId: string) => void;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "2px",
        px: "6px",
        py: "4px",
        mb: "16px",
      }}
    >
      <JoyTooltip title="Helpful" placement="bottom">
        <IconButton
          variant="plain"
          color="neutral"
          size="sm"
          aria-label="Mark response as helpful"
          aria-pressed={feedback === "liked"}
          onClick={() => onFeedback(message.id, "liked")}
          sx={actionIconButtonSx(feedback === "liked")}
        >
          <ThumbsUp size={14} strokeWidth={1.75} />
        </IconButton>
      </JoyTooltip>

      <JoyTooltip title="Not helpful" placement="bottom">
        <IconButton
          variant="plain"
          color="neutral"
          size="sm"
          aria-label="Mark response as not helpful"
          aria-pressed={feedback === "disliked"}
          onClick={() => onFeedback(message.id, "disliked")}
          sx={actionIconButtonSx(feedback === "disliked")}
        >
          <ThumbsDown size={14} strokeWidth={1.75} />
        </IconButton>
      </JoyTooltip>

      <JoyTooltip
        title={isCopied ? "Copied!" : "Copy response"}
        placement="bottom"
      >
        <IconButton
          variant="plain"
          color="neutral"
          size="sm"
          aria-label="Copy response"
          onClick={() => onCopy(message.id, message.content)}
          sx={actionIconButtonSx(false)}
        >
          {isCopied ? (
            <Check
              size={14}
              strokeWidth={1.75}
              color="var(--joy-palette-neutral-800)"
            />
          ) : (
            <Copy size={14} strokeWidth={1.75} />
          )}
        </IconButton>
      </JoyTooltip>

      {isLatestMessage ? (
        <JoyTooltip title="Regenerate" placement="bottom">
          <IconButton
            variant="plain"
            color="neutral"
            size="sm"
            aria-label="Regenerate response"
            onClick={() => onRegenerate(message.id)}
            sx={actionIconButtonSx(false)}
          >
            <RotateCcw size={14} strokeWidth={1.75} />
          </IconButton>
        </JoyTooltip>
      ) : null}
    </Box>
  );
}

const ASK_BLOOM_CONNECTING_MESSAGE = "Connecting to Bloom…";

const ASK_BLOOM_THINKING_MESSAGES = [
  "Thinking…",
  "Analyzing your request…",
  "Processing…",
  "Preparing response…",
  "Working on it…",
  "Almost there…",
];

const ASK_BLOOM_GENERATING_MESSAGES = [
  "Compiling response…",
  "Putting it together…",
  "Generating answer…",
  "Writing response…",
];

const ASK_BLOOM_TOOL_MESSAGES: Record<string, string[]> = {
  search_customers: [
    "Searching your customers…",
    "Looking through customer records…",
    "Finding matching customers…",
  ],
  get_customer: ["Pulling up customer details…", "Loading customer profile…"],
  lookup_customer: ["Looking up customer…", "Finding customer information…"],
  search_products: [
    "Browsing your product catalog…",
    "Searching products…",
    "Looking through inventory…",
  ],
  get_product: ["Loading product details…", "Pulling up product info…"],
  check_inventory: [
    "Checking stock levels…",
    "Scanning inventory…",
    "Counting available stock…",
  ],
  search_campaigns: [
    "Reviewing your campaigns…",
    "Loading campaign data…",
    "Analyzing campaign performance…",
  ],
  get_campaign: ["Pulling up campaign details…", "Loading campaign metrics…"],
  search_orders: [
    "Searching order history…",
    "Looking through orders…",
    "Finding matching orders…",
  ],
  get_order: ["Loading order details…", "Pulling up order information…"],
  get_analytics: [
    "Crunching the numbers…",
    "Analyzing your data…",
    "Building analytics report…",
    "Processing metrics…",
  ],
  get_revenue: [
    "Calculating revenue…",
    "Tallying sales data…",
    "Analyzing revenue trends…",
  ],
  export_data: [
    "Preparing your export…",
    "Packaging data for download…",
    "Building export file…",
  ],
  generate_image: [
    "Creating your image…",
    "Generating artwork…",
    "Painting your vision…",
    "Crafting the image…",
  ],
  build_segment: [
    "Building customer segment…",
    "Analyzing audience criteria…",
    "Segmenting your customers…",
  ],
  navigate: ["Finding the right page…", "Locating that for you…"],
};

const shimmerTextSx = (theme: Theme) => {
  const isDark = theme.palette.mode === "dark";
  const base = isDark ? "#86efac" : "#1a3a2a";
  const mid = isDark ? "#4ade80" : "#2d6b4f";
  const highlight = isDark ? "#2d6b4f" : "#4ade80";
  const glow = isDark ? "#bbf7d0" : "#86efac";
  const fallback = isDark ? "#86efac" : "#2d6b4f";
  return {
    background: `linear-gradient(90deg, ${base} 0%, ${base} 30%, ${mid} 40%, ${highlight} 48%, ${glow} 50%, ${highlight} 52%, ${mid} 60%, ${base} 70%, ${base} 100%)`,
    backgroundSize: "200% auto",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    animation: "askBloomShimmer 2.5s ease-in-out infinite",
    "@keyframes askBloomShimmer": {
      "0%": { backgroundPosition: "-200% center" },
      "100%": { backgroundPosition: "200% center" },
    },
    "@media (prefers-reduced-motion: reduce)": {
      animation: "none",
      background: "none",
      WebkitTextFillColor: fallback,
      color: fallback,
    },
  };
};

const iconPulseSx = (theme: Theme) => ({
  display: "inline-flex",
  alignItems: "center",
  color: theme.palette.mode === "dark" ? "#86efac" : "#2d6b4f",
  animation: "askBloomIconPulse 2s ease-in-out infinite",
  "@keyframes askBloomIconPulse": {
    "0%, 100%": { transform: "scale(1)", opacity: 0.8 },
    "50%": { transform: "scale(1.15)", opacity: 1 },
  },
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
});

function AskBloomStreamingIndicator({
  activeToolCall,
  hasContent,
  overrideMessage,
}: {
  activeToolCall: AskBloomActiveToolCall | null;
  hasContent: boolean;
  overrideMessage?: string | null;
}) {
  const [idleIndex, setIdleIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setIdleIndex((prev) => prev + 1);
    }, 2000);
    return () => window.clearInterval(interval);
  }, []);

  const currentMessage = React.useMemo(() => {
    if (overrideMessage) {
      return overrideMessage;
    }
    if (activeToolCall) {
      const messages = ASK_BLOOM_TOOL_MESSAGES[activeToolCall.toolName];
      if (messages && messages.length > 0) {
        return messages[idleIndex % messages.length];
      }
      const cleanName = activeToolCall.toolName.replace(/_/g, " ").trim();
      return `Running ${cleanName}…`;
    }
    if (hasContent) {
      return ASK_BLOOM_GENERATING_MESSAGES[
        idleIndex % ASK_BLOOM_GENERATING_MESSAGES.length
      ];
    }
    if (idleIndex === 0) {
      return ASK_BLOOM_CONNECTING_MESSAGE;
    }
    return ASK_BLOOM_THINKING_MESSAGES[
      (idleIndex - 1) % ASK_BLOOM_THINKING_MESSAGES.length
    ];
  }, [activeToolCall, hasContent, idleIndex, overrideMessage]);

  const [displayText, setDisplayText] = React.useState(currentMessage);
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  React.useEffect(() => {
    if (currentMessage === displayText) {
      return;
    }
    setIsTransitioning(true);
    const timer = window.setTimeout(() => {
      setDisplayText(currentMessage);
      setIsTransitioning(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [currentMessage, displayText]);

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        py: "12px",
        px: "4px",
        mb: "16px",
      }}
    >
      <Box component="span" aria-hidden="true" sx={iconPulseSx}>
        <Sparkles size={16} strokeWidth={2} />
      </Box>
      <Typography
        level="body-sm"
        fontWeight={500}
        sx={[
          shimmerTextSx,
          {
            transition: "opacity 200ms ease",
            opacity: isTransitioning ? 0 : 1,
            letterSpacing: "0.01em",
          },
        ]}
      >
        {displayText}
      </Typography>
    </Box>
  );
}

function AskBloomStreamError({
  error,
  onRetry,
  onKeepPartial,
}: {
  error: string;
  onRetry: () => void;
  onKeepPartial: () => void;
}) {
  return (
    <Stack
      spacing={1}
      sx={{
        mt: "4px",
        pt: "10px",
        borderTop: "1px solid",
        borderColor: "neutral.outlinedBorder",
      }}
    >
      <Stack direction="row" spacing={0.75} alignItems="flex-start">
        <Box sx={{ color: "danger.500", display: "inline-flex", mt: "1px" }}>
          <AlertTriangle size={14} strokeWidth={1.9} />
        </Box>
        <Typography level="body-xs" sx={{ color: "danger.600" }}>
          {error}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Button
          size="sm"
          variant="outlined"
          color="neutral"
          startDecorator={<RotateCcw size={13} strokeWidth={1.9} />}
          onClick={onRetry}
        >
          Retry
        </Button>
        <Button
          size="sm"
          variant="plain"
          color="neutral"
          onClick={onKeepPartial}
        >
          Keep partial response
        </Button>
      </Stack>
    </Stack>
  );
}

function MessageBubble({
  message,
  isLatestMessage,
  feedback,
  onFeedback,
  isCopied,
  onCopy,
  onRegenerate,
}: {
  message: AskBloomMessage;
  isLatestMessage: boolean;
  feedback: MessageFeedback | null;
  onFeedback: (messageId: string, type: MessageFeedback) => void;
  isCopied: boolean;
  onCopy: (messageId: string, content: string) => void;
  onRegenerate: (messageId: string) => void;
}) {
  const askBloom = useAskBloom();
  const isUser = message.role === "user";
  const presentedFormMessageRef = React.useRef<string | null>(null);

  const handleBlockRetry = React.useCallback(() => {
    const lastUserMessage = [...askBloom.state.messages]
      .reverse()
      .find((entry) => entry.role === "user");
    if (lastUserMessage) {
      askBloom.sendMessage(lastUserMessage.content);
    }
  }, [askBloom]);

  if (isUser) {
    const attachments = message.attachments ?? [];
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          mb: "16px",
        }}
      >
        <Box
          sx={{
            width: { xs: "90%", md: "75%" },
            maxWidth: { xs: "90%", md: "75%" },
            minWidth: 0,
            backgroundColor: "var(--joy-palette-brandNavy-700)",
            border: "none",
            borderRadius: "16px 16px 4px 16px",
            px: 2,
            py: 1.25,
            boxShadow: "none",
          }}
        >
          <Stack spacing={1} sx={{ minWidth: 0 }}>
            <Typography
              level="body-md"
              sx={{
                color: "common.white",
                fontSize: "16px",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {message.content}
            </Typography>
            {attachments.length > 0 ? (
              <BloomAttachmentDisplay attachments={attachments} />
            ) : null}
          </Stack>
        </Box>
      </Box>
    );
  }

  const rawBlocks: AskBloomBlock[] =
    message.blocks.length > 0
      ? message.blocks
      : [{ type: "text", content: message.content, data: {} } as AskBloomBlock];
  const isLatestAssistantMessage =
    message.role === "assistant" && isLatestMessage;
  const isLatestStreamingAssistantMessage =
    isLatestAssistantMessage && message.isStreaming;
  const messageToolResultBloomBlocks = React.useMemo(
    () =>
      rawBlocks
        .map((block) => toBloomContentBlock(block))
        .filter(isToolResultContentBlock),
    [rawBlocks],
  );
  const latestStreamingToolResultBloomBlocks = React.useMemo(
    () =>
      isLatestStreamingAssistantMessage
        ? askBloom.state.streamingBlocks
            .map((block) => contentBlockFromStreamingBlock(block))
            .filter(isToolResultContentBlock)
        : [],
    [askBloom.state.streamingBlocks, isLatestStreamingAssistantMessage],
  );
  const toolResultBloomBlocks = React.useMemo(
    () =>
      mergeToolResultBlocks(
        messageToolResultBloomBlocks,
        latestStreamingToolResultBloomBlocks,
      ),
    [latestStreamingToolResultBloomBlocks, messageToolResultBloomBlocks],
  );
  const gateDecision = React.useMemo(() => {
    if (!isLatestAssistantMessage || !message.content.trim()) {
      return { action: "pass" } as const;
    }

    return analyzeStreamingContent(message.content, {
      hasToolResultBlocks: toolResultBloomBlocks.length > 0,
      toolResultIdentifiers: extractIdentifiersFromToolResults(
        toolResultBloomBlocks,
      ),
      isAfterToolResult: toolResultBloomBlocks.length > 0,
    });
  }, [isLatestAssistantMessage, message.content, toolResultBloomBlocks]);
  const resourceFormGate = React.useMemo(() => {
    if (!isLatestAssistantMessage) {
      return null;
    }

    if (gateDecision.action === "intercept_form") {
      return gateDecision;
    }

    const originalContent = message.originalContent?.trim() ?? "";
    const visibleContent = message.content.trim();
    if (!originalContent || originalContent === visibleContent) {
      return null;
    }

    const detectedForm = detectFormRequest(originalContent);
    return detectedForm?.action === "intercept_form" ? detectedForm : null;
  }, [
    gateDecision,
    isLatestAssistantMessage,
    message.content,
    message.originalContent,
  ]);

  React.useEffect(() => {
    if (!isLatestAssistantMessage || !resourceFormGate) {
      return;
    }

    const activePendingFormMessageId =
      askBloom.state.pendingResourceForm?.messageId ?? null;
    if (activePendingFormMessageId) {
      if (activePendingFormMessageId === message.id) {
        presentedFormMessageRef.current = message.id;
      }
      return;
    }

    if (presentedFormMessageRef.current === message.id) {
      return;
    }

    presentedFormMessageRef.current = message.id;
    askBloom.presentResourceForm({
      messageId: message.id,
      resourceType: resourceFormGate.resourceType,
      fields: resourceFormGate.fields,
      prefilledValues: resourceFormGate.prefilledValues,
    });
  }, [
    askBloom,
    askBloom.state.pendingResourceForm?.messageId,
    isLatestAssistantMessage,
    message.id,
    resourceFormGate,
  ]);

  const blocks: AskBloomBlock[] = rawBlocks
    .map((block) => {
      if (block.type !== "text") {
        return block;
      }

      let content = block.content;

      if (isLatestAssistantMessage) {
        if (resourceFormGate) {
          content = stripStreamingMarkdownTables(
            extractPreFormText(content) || content,
          );
        } else if (isGlobalGateAction(gateDecision)) {
          content = "";
        }
      }

      if (
        isLatestStreamingAssistantMessage &&
        !resourceFormGate &&
        !isGlobalGateAction(gateDecision)
      ) {
        content = stripStreamingMarkdownTables(content);
      }

      content = stripToolJsonFromText(content);
      if (toolResultBloomBlocks.length > 0) {
        content = stripRedundantContent(content, toolResultBloomBlocks);
      }
      return content === block.content ? block : { ...block, content };
    })
    .filter(
      (block) => block.type !== "text" || block.content.trim().length > 0,
    );
  const hasVisibleContent = blocks.some(
    (block) => block.type !== "text" || block.content.trim().length > 0,
  );
  const showActionRow = !message.isStreaming;
  const thinkingContent = askBloom.state.thinkingContent;
  const activeToolCall = askBloom.state.activeToolCall;
  const gateSuppressesVisibleText =
    isLatestStreamingAssistantMessage &&
    (isGlobalGateAction(gateDecision) ||
      (gateDecision.action === "suppress" && !hasVisibleContent));
  const gateIndicatorMessage =
    gateSuppressesVisibleText && gateDecision.action !== "pass"
      ? gateLoaderMessage(gateDecision)
      : null;
  const showStreamingIndicator =
    message.isStreaming &&
    !gateIndicatorMessage &&
    (!hasVisibleContent || Boolean(activeToolCall));
  const streamError = isLatestMessage ? askBloom.state.streamError : null;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        width: "100%",
      }}
    >
      {message.isStreaming && thinkingContent && thinkingContent.trim() ? (
        <Box sx={{ maxWidth: "92%", mr: "auto", mb: "10px", width: "100%" }}>
          <ThinkingBlock
            content={thinkingContent}
            defaultExpanded
            isStreaming
          />
        </Box>
      ) : null}

      {hasVisibleContent ? (
        <Box
          sx={{
            maxWidth: "92%",
            mr: "auto",
            backgroundColor: "background.surface",
            border: "1px solid",
            borderColor: "neutral.outlinedBorder",
            borderRadius: "10px",
            p: "16px 18px",
            boxShadow: "none",
            mb: showActionRow ? "4px" : showStreamingIndicator ? "8px" : "16px",
          }}
        >
          <Stack spacing={1.25}>
            {blocks.map((block, index) => (
              <React.Fragment key={block.id ?? `${message.id}-block-${index}`}>
                {renderStructuredBlock(
                  block,
                  message.id,
                  askBloom.sendMessage,
                  isLatestMessage && !message.isStreaming,
                  handleBlockRetry,
                )}
              </React.Fragment>
            ))}
            {streamError ? (
              <AskBloomStreamError
                error={streamError}
                onRetry={askBloom.retryStream}
                onKeepPartial={askBloom.keepPartialResponse}
              />
            ) : null}
          </Stack>
        </Box>
      ) : null}

      {gateIndicatorMessage ? (
        <AskBloomStreamingIndicator
          activeToolCall={activeToolCall}
          hasContent={hasVisibleContent}
          overrideMessage={gateIndicatorMessage}
        />
      ) : null}

      {showStreamingIndicator ? (
        <AskBloomStreamingIndicator
          activeToolCall={activeToolCall}
          hasContent={hasVisibleContent}
        />
      ) : null}

      {!hasVisibleContent && streamError ? (
        <Box sx={{ maxWidth: "92%", mr: "auto", mb: "16px", width: "100%" }}>
          <AskBloomStreamError
            error={streamError}
            onRetry={askBloom.retryStream}
            onKeepPartial={askBloom.keepPartialResponse}
          />
        </Box>
      ) : null}

      {showActionRow ? (
        <MessageActionRow
          message={message}
          isLatestMessage={isLatestMessage}
          feedback={feedback}
          onFeedback={onFeedback}
          isCopied={isCopied}
          onCopy={onCopy}
          onRegenerate={onRegenerate}
        />
      ) : null}
    </Box>
  );
}

export function AskBloomConversationArea() {
  const askBloom = useAskBloom();
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const lastRenderableMessagesRef = React.useRef<{
    conversationId: string | null;
    resourceKey: string | null;
    messages: AskBloomMessage[];
  }>({ conversationId: null, resourceKey: null, messages: [] });
  const renderedContextRef = React.useRef<{
    conversationId: string | null;
    resourceKey: string | null;
  }>({ conversationId: null, resourceKey: null });
  const shouldAutoScrollRef = React.useRef(true);
  const dotOverlayRef = React.useRef<HTMLDivElement | null>(null);
  const pointerRafRef = React.useRef<number | null>(null);
  const evidenceLatchTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [feedbackMap, setFeedbackMap] = React.useState<
    Record<string, MessageFeedback | null>
  >({});
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const copyResetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);
  const [hasEvidenceLatch, setHasEvidenceLatch] = React.useState(false);
  const activeConversationId = askBloom.state.conversationId;
  const activeResourceKey = askBloom.state.resourceFocus
    ? `${askBloom.state.resourceFocus.resourceType}:${askBloom.state.resourceFocus.resourceId}`
    : null;

  const handleFeedback = React.useCallback(
    (messageId: string, type: MessageFeedback) => {
      setFeedbackMap((previous) => ({
        ...previous,
        [messageId]: previous[messageId] === type ? null : type,
      }));
      // TODO: Persist feedback to bloom_messages via provider action
    },
    [],
  );

  const handleCopy = React.useCallback((messageId: string, content: string) => {
    void navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    if (copyResetRef.current !== null) {
      clearTimeout(copyResetRef.current);
    }
    copyResetRef.current = setTimeout(() => {
      setCopiedId(null);
      copyResetRef.current = null;
    }, 2000);
  }, []);

  const handleRegenerate = React.useCallback(() => {
    askBloom.retryStream();
  }, [askBloom]);

  React.useEffect(
    () => () => {
      if (copyResetRef.current !== null) {
        clearTimeout(copyResetRef.current);
      }
      if (evidenceLatchTimerRef.current !== null) {
        clearTimeout(evidenceLatchTimerRef.current);
      }
    },
    [],
  );

  const handleDotPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const overlay = dotOverlayRef.current;
      if (!overlay) {
        return;
      }

      const rect = overlay.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (pointerRafRef.current !== null) {
        cancelAnimationFrame(pointerRafRef.current);
      }

      pointerRafRef.current = requestAnimationFrame(() => {
        overlay.style.setProperty("--dot-mask-x", `${x}px`);
        overlay.style.setProperty("--dot-mask-y", `${y}px`);
        overlay.style.setProperty("--dot-mask-opacity", "1");
      });
    },
    [],
  );

  const handleDotPointerLeave = React.useCallback(() => {
    const overlay = dotOverlayRef.current;
    if (overlay) {
      overlay.style.setProperty("--dot-mask-opacity", "0");
    }
  }, []);

  React.useEffect(
    () => () => {
      if (pointerRafRef.current !== null) {
        cancelAnimationFrame(pointerRafRef.current);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (askBloom.state.messages.length > 0) {
      lastRenderableMessagesRef.current = {
        conversationId:
          activeConversationId ??
          askBloom.state.messages[0]?.conversationId ??
          null,
        resourceKey: activeResourceKey,
        messages: askBloom.state.messages,
      };
    }
  }, [activeConversationId, activeResourceKey, askBloom.state.messages]);

  React.useEffect(() => {
    const previousContext = renderedContextRef.current;
    if (
      previousContext.conversationId === activeConversationId &&
      previousContext.resourceKey === activeResourceKey
    ) {
      return;
    }

    renderedContextRef.current = {
      conversationId: activeConversationId,
      resourceKey: activeResourceKey,
    };
    lastRenderableMessagesRef.current =
      askBloom.state.messages.length > 0
        ? {
            conversationId:
              activeConversationId ??
              askBloom.state.messages[0]?.conversationId ??
              null,
            resourceKey: activeResourceKey,
            messages: askBloom.state.messages,
          }
        : {
            conversationId: activeConversationId,
            resourceKey: activeResourceKey,
            messages: [],
          };

    if (evidenceLatchTimerRef.current !== null) {
      clearTimeout(evidenceLatchTimerRef.current);
      evidenceLatchTimerRef.current = null;
    }
    setHasEvidenceLatch(false);
  }, [activeConversationId, activeResourceKey, askBloom.state.messages]);

  const handleScroll = React.useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const atBottom =
      container.scrollHeight - (container.scrollTop + container.clientHeight) <=
      50;
    shouldAutoScrollRef.current = atBottom;
    setShowScrollButton(!atBottom);
  }, []);

  const scrollToBottom = React.useCallback(() => {
    shouldAutoScrollRef.current = true;
    setShowScrollButton(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  React.useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    bottomRef.current?.scrollIntoView({
      behavior: askBloom.state.isStreaming ? "auto" : "smooth",
      block: "end",
    });
  }, [askBloom.state.isStreaming, askBloom.state.messages]);

  const hasLiveConversationEvidence =
    askBloom.state.messages.length > 0 ||
    askBloom.state.isTransitioning ||
    askBloom.state.isSendingMessage ||
    askBloom.state.isLoadingConversation ||
    askBloom.state.isStreaming ||
    Boolean(askBloom.state.pendingTaskPlan) ||
    Boolean(askBloom.state.pendingResourceForm) ||
    Boolean(askBloom.state.streamError) ||
    Boolean(askBloom.state.activeToolCall) ||
    Boolean(askBloom.state.thinkingContent?.trim()) ||
    askBloom.state.streamingBlocks.length > 0;

  React.useEffect(() => {
    if (hasLiveConversationEvidence) {
      if (evidenceLatchTimerRef.current !== null) {
        clearTimeout(evidenceLatchTimerRef.current);
        evidenceLatchTimerRef.current = null;
      }
      setHasEvidenceLatch(true);
      return;
    }

    if (!hasEvidenceLatch || evidenceLatchTimerRef.current !== null) {
      return;
    }

    evidenceLatchTimerRef.current = setTimeout(() => {
      evidenceLatchTimerRef.current = null;
      setHasEvidenceLatch(false);
    }, ASK_BLOOM_EVIDENCE_LATCH_MS);
  }, [hasEvidenceLatch, hasLiveConversationEvidence]);

  const lastRenderableSnapshot = lastRenderableMessagesRef.current;
  const isSameConversationEmptyGap =
    askBloom.state.messages.length === 0 &&
    lastRenderableSnapshot.messages.length > 0 &&
    activeConversationId !== null &&
    lastRenderableSnapshot.conversationId === activeConversationId;
  const shouldPreserveVisibleMessages =
    askBloom.state.isLoadingConversation ||
    askBloom.state.isTransitioning ||
    askBloom.state.isSendingMessage ||
    askBloom.state.isStreaming ||
    (hasEvidenceLatch && isSameConversationEmptyGap);
  const renderedMessages =
    askBloom.state.messages.length > 0
      ? askBloom.state.messages
      : shouldPreserveVisibleMessages
        ? lastRenderableSnapshot.messages
        : [];
  const hasRenderedMessages = renderedMessages.length > 0;
  const hasConversationEvidence =
    hasRenderedMessages || hasLiveConversationEvidence || hasEvidenceLatch;
  const shouldShowWelcome = !hasConversationEvidence;
  const showConversationLayer = hasRenderedMessages || !shouldShowWelcome;
  const showLoadingOverlay =
    askBloom.state.isLoadingConversation && !hasRenderedMessages;

  return (
    <Box
      sx={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        ref={scrollContainerRef}
        aria-hidden={!showConversationLayer}
        onScroll={handleScroll}
        sx={{
          position: "absolute",
          inset: 0,
          overflowY: "auto",
          overflowX: "hidden",
          ...hiddenScrollbarSx,
          px: 1.5,
          pt: 1,
          pb: floatingComposerPadding,
          opacity: showConversationLayer ? 1 : 0,
          pointerEvents: showConversationLayer ? "auto" : "none",
          transition: "opacity 180ms ease",
        }}
      >
        <NavigationPromptCard />
        {renderedMessages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLatestMessage={index === renderedMessages.length - 1}
            feedback={feedbackMap[message.id] ?? null}
            onFeedback={handleFeedback}
            isCopied={copiedId === message.id}
            onCopy={handleCopy}
            onRegenerate={handleRegenerate}
          />
        ))}
        <div ref={bottomRef} />
      </Box>
      <Box
        aria-hidden={!shouldShowWelcome}
        onPointerMove={handleDotPointerMove}
        onPointerLeave={handleDotPointerLeave}
        sx={{
          position: "absolute",
          inset: 0,
          overflowY: "auto",
          overflowX: "hidden",
          ...hiddenScrollbarSx,
          px: 1.5,
          pt: 1,
          pb: floatingComposerPadding,
          backgroundColor: "transparent",
          opacity: shouldShowWelcome ? 1 : 0,
          pointerEvents: shouldShowWelcome ? "auto" : "none",
          transition: "opacity 180ms ease",
        }}
      >
        <Box
          ref={dotOverlayRef}
          aria-hidden="true"
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            opacity: "var(--dot-mask-opacity, 0)",
            transition: "opacity 320ms ease",
            backgroundImage: `radial-gradient(var(--joy-palette-primary-500) 1px, transparent 1px)`,
            backgroundSize: "10px 10px",
            backgroundPosition: "center",
            WebkitMaskImage: `radial-gradient(130px circle at var(--dot-mask-x, -200px) var(--dot-mask-y, -200px), #000 0%, rgba(0, 0, 0, 0.55) 45%, transparent 72%)`,
            maskImage: `radial-gradient(130px circle at var(--dot-mask-x, -200px) var(--dot-mask-y, -200px), #000 0%, rgba(0, 0, 0, 0.55) 45%, transparent 72%)`,
          }}
        />
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            minHeight: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <NavigationPromptCard />
          <WelcomeState />
        </Box>
      </Box>
      <Box
        aria-hidden={!showLoadingOverlay}
        sx={{
          position: "absolute",
          inset: 0,
          overflowY: "auto",
          overflowX: "hidden",
          ...hiddenScrollbarSx,
          px: 1.5,
          pt: 1,
          pb: floatingComposerPadding,
          opacity: showLoadingOverlay ? 1 : 0,
          pointerEvents: "none",
          transition: "opacity 180ms ease",
        }}
      >
        <LoadingState />
      </Box>
      {showScrollButton && hasRenderedMessages && showConversationLayer ? (
        <IconButton
          variant="soft"
          color="neutral"
          size="sm"
          aria-label="Scroll to latest message"
          onClick={scrollToBottom}
          sx={{
            position: "absolute",
            right: 16,
            bottom: floatingScrollButtonBottom,
            zIndex: 2,
            borderRadius: "50%",
            backgroundColor: "background.surface",
            border: "1px solid",
            borderColor: "neutral.outlinedBorder",
            boxShadow: "md",
            "&:hover": { backgroundColor: "background.level1" },
          }}
        >
          <ChevronDown size={16} strokeWidth={2} />
        </IconButton>
      ) : null}
    </Box>
  );
}
