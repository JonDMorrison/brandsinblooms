import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Link from "@mui/joy/Link";
import Skeleton from "@mui/joy/Skeleton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  BarChart3,
  Clock,
  FileText,
  GitCompare,
  Info,
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
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AskBloomActionCard } from "@/components/askBloom/AskBloomActionCard";
import { useAskBloomInsights } from "@/hooks/askBloom/useAskBloomInsights";
import { useAskBloom } from "@/providers/AskBloomProvider";
import type { AskBloomBlock, AskBloomInsight, AskBloomMessage } from "@/types/askBloom";
import { getAskBloomStarterConfig } from "@/utils/askBloomStarters";
import { humanizeAskBloomResourceType } from "@/utils/askBloomRouteContext";

const markdownComponents = {
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <Typography
      {...props}
      component="p"
      level="body-sm"
      sx={{ mb: 1, "&:last-child": { mb: 0 } }}
    />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <Box component="ul" {...props} sx={{ pl: 2.5, my: 1 }} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <Box component="ol" {...props} sx={{ pl: 2.5, my: 1 }} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <Typography {...props} component="li" level="body-sm" sx={{ mb: 0.5 }} />
  ),
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <Box component="strong" {...props} sx={{ fontWeight: 600 }} />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <Box
      component="code"
      {...props}
      sx={{
        px: 0.5,
        py: 0.125,
        borderRadius: "sm",
        bgcolor: "background.level1",
        fontFamily: "monospace",
        fontSize: "0.85em",
      }}
    />
  ),
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

function StarterIcon({ name }: { name: string }) {
  const Icon = STARTER_ICON_MAP[name] ?? Sparkles;
  return <Icon aria-hidden="true" size={18} strokeWidth={1.8} />;
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

const renderStructuredBlock = (
  block: AskBloomBlock,
  messageId: string,
  onPromptClick: (prompt: string) => void,
  showStreamingCursor: boolean,
  showSuggestionChips: boolean,
) => {
  if (block.type === "text") {
    return (
      <Box key={`${block.type}-${block.content.slice(0, 20)}`} sx={{ minWidth: 0 }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {block.content}
        </ReactMarkdown>
        {showStreamingCursor ? (
          <Box
            component="span"
            aria-hidden="true"
            sx={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "999px",
              bgcolor: "primary.500",
              ml: 0.5,
              animation: "askBloomStreamCursor 1s step-end infinite",
              "@keyframes askBloomStreamCursor": {
                "0%, 50%": { opacity: 1 },
                "51%, 100%": { opacity: 0 },
              },
            }}
          />
        ) : null}
      </Box>
    );
  }

  if (block.type === "suggestion_chips") {
    if (!showSuggestionChips) {
      return null;
    }

    const suggestions = Array.isArray(block.data.suggestions)
      ? block.data.suggestions.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
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
          gap: 1,
          flexWrap: "wrap",
          mt: 0.5,
        }}
      >
        {suggestions.map((suggestion) => (
          <Chip
            key={suggestion}
            size="sm"
            variant="outlined"
            color="neutral"
            onClick={() => onPromptClick(suggestion)}
            sx={{ cursor: "pointer" }}
          >
            {suggestion}
          </Chip>
        ))}
      </Box>
    );
  }

  if (block.type === "mutation_action") {
    return (
      <AskBloomActionCard
        key={block.mutationId}
        messageId={messageId}
        block={block}
      />
    );
  }

  return (
    <Sheet
      key={`${block.type}-${JSON.stringify(block.data).slice(0, 20)}`}
      variant="outlined"
      sx={{
        p: 1.25,
        borderRadius: "md",
        bgcolor: "background.level1",
      }}
    >
      <Typography level="body-xs" sx={{ color: "text.secondary", mb: 0.75 }}>
        {block.type.replace(/_/g, " ")}
      </Typography>
      {block.content ? (
        <Typography level="body-sm" sx={{ mb: 0.75 }}>
          {block.content}
        </Typography>
      ) : null}
      <Box
        component="pre"
        sx={{
          m: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "monospace",
          fontSize: "12px",
          color: "text.secondary",
        }}
      >
        {JSON.stringify(block.data, null, 2)}
      </Box>
    </Sheet>
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
      spacing={2.5}
      sx={{
        width: "100%",
        maxWidth: 460,
        mx: "auto",
        px: 1,
        py: 2.5,
      }}
    >
      <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "primary.400",
          }}
        >
          <Sparkles aria-hidden="true" size={32} strokeWidth={1.8} />
        </Box>
        <Typography
          level="h4"
          sx={{
            mt: 2,
            fontWeight: 500,
            letterSpacing: "-0.015em",
            color: "text.primary",
            maxWidth: 360,
          }}
        >
          {starterConfig.greeting}
        </Typography>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 1,
        }}
      >
        {starterConfig.starters.map((starter) => (
          <Button
            key={starter.label}
            color="neutral"
            size="md"
            variant="outlined"
            sx={{
              width: "100%",
              minHeight: 56,
              justifyContent: "flex-start",
              textAlign: "left",
              borderRadius: "10px",
              gap: 1,
            }}
            onClick={() => askBloom.sendMessage(starter.prompt)}
          >
            <StarterIcon name={starter.icon} />
            <Typography level="body-sm" sx={{ textAlign: "left", flex: 1 }}>
              {starter.label}
            </Typography>
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
                  <Skeleton variant="rectangular" sx={{ height: 16, borderRadius: "sm" }} />
                  <Skeleton variant="rectangular" sx={{ height: 12, borderRadius: "sm" }} />
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
                  <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                    <InsightIcon type={insight.type} />
                    <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                      <Typography level="title-sm" sx={{ fontWeight: 500 }}>
                        {insight.title}
                      </Typography>
                      <Typography level="body-xs" sx={{ color: "text.secondary" }}>
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
                        onClick={() => askBloom.sendMessage(insight.suggestedPrompt!)}
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
                borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
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
          {humanizeAskBloomResourceType(navigationPrompt.newResourceType).toLowerCase()}.
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
          <Button size="sm" variant="solid" onClick={askBloom.acceptNavigationPrompt}>
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

function MessageBubble({
  message,
  previousRole,
  isLatestMessage,
}: {
  message: AskBloomMessage;
  previousRole: AskBloomMessage["role"] | null;
  isLatestMessage: boolean;
}) {
  const askBloom = useAskBloom();
  const isUser = message.role === "user";
  const topSpacing = previousRole === message.role ? 1 : 2;
  const blocks =
    message.blocks.length > 0
      ? message.blocks
      : [{ type: "text", content: message.content, data: {} }];
  const lastTextBlockIndex = blocks.reduce((latestIndex, block, index) => {
    return block.type === "text" ? index : latestIndex;
  }, -1);

  return (
    <Box
      sx={{
        mt: topSpacing,
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <Sheet
        variant="plain"
        sx={{
          maxWidth: isUser ? "84%" : "92%",
          px: 1.75,
          py: 1.25,
          borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
          bgcolor: isUser ? "primary.softBg" : "background.level1",
          boxShadow: isUser ? "none" : "sm",
        }}
      >
        {isUser ? (
          <Typography
            level="body-sm"
            sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          >
            {message.content}
          </Typography>
        ) : (
          <Stack spacing={1.25}>
            {blocks.map((block, index) =>
              renderStructuredBlock(
                block,
                message.id,
                askBloom.sendMessage,
                message.isStreaming && index === lastTextBlockIndex,
                !isUser && isLatestMessage && !message.isStreaming,
              ),
            )}
          </Stack>
        )}
      </Sheet>
    </Box>
  );
}

export function AskBloomConversationArea() {
  const askBloom = useAskBloom();
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = React.useRef(true);

  const handleScroll = React.useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    shouldAutoScrollRef.current =
      container.scrollHeight - (container.scrollTop + container.clientHeight) <= 50;
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

  if (askBloom.state.isLoadingConversation) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <LoadingState />
      </Box>
    );
  }

  if (askBloom.state.messages.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: 1.5,
          py: 1,
        }}
      >
        <NavigationPromptCard />
        <WelcomeState />
      </Box>
    );
  }

  return (
    <Box
      ref={scrollContainerRef}
      onScroll={handleScroll}
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        px: 1.5,
        py: 1,
      }}
    >
      <NavigationPromptCard />
      {askBloom.state.messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          previousRole={index > 0 ? askBloom.state.messages[index - 1].role : null}
          isLatestMessage={index === askBloom.state.messages.length - 1}
        />
      ))}
      <div ref={bottomRef} />
    </Box>
  );
}
