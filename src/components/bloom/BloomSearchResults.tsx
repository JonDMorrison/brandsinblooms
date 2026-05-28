import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import ListItemButton from "@mui/joy/ListItemButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { BloomConversation } from "@/hooks/bloom/types";
import type { SearchResult } from "@/hooks/bloom/useBloomMessageSearch";

interface BloomSearchResultsProps {
  titleResults: BloomConversation[];
  messageResults: SearchResult[];
  query: string;
  selectedIndex: number | null;
  onConversationClick: (conversation: BloomConversation) => void;
  onMessageClick: (result: SearchResult) => void;
  onSelectedIndexChange: (index: number) => void;
}

const formatResultDate = (value: string) =>
  new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

const resultButtonSx = (selected: boolean) => ({
  width: "100%",
  minHeight: 58,
  alignItems: "flex-start",
  position: "relative",
  overflow: "hidden",
  borderRadius: "var(--joy-radius-lg)",
  border: "1px solid",
  borderColor: selected ? "brandNavy.500" : "transparent",
  backgroundColor: selected ? "brandNavy.800" : "transparent",
  color: selected ? "common.white" : "brandNavy.50",
  px: 1.35,
  py: 0.85,
  boxShadow: selected
    ? "inset 0 0 0 1px rgba(var(--joy-palette-brandNavy-lightChannel) / 0.14)"
    : "none",
  transition:
    "background-color 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1)",
  "&:hover": {
    backgroundColor: "brandNavy.800",
    borderColor: "brandNavy.500",
  },
  "&.Mui-focusVisible, &:focus-visible": {
    outline: 0,
    boxShadow: "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.22)",
  },
});

function SearchSectionLabel({ children }: { children: string }) {
  return (
    <Typography
      level="body-xs"
      sx={{ px: 3, pt: 1.25, pb: 0.25, color: "brandNavy.300" }}
    >
      {children}
    </Typography>
  );
}

export function BloomSearchResults({
  titleResults,
  messageResults,
  query,
  selectedIndex,
  onConversationClick,
  onMessageClick,
  onSelectedIndexChange,
}: BloomSearchResultsProps) {
  const normalizedQuery = query.trim();
  const messageOffset = titleResults.length;

  if (!normalizedQuery) {
    return null;
  }

  return (
    <List
      size="sm"
      sx={{
        "--ListItem-paddingY": 0,
        "--ListItem-paddingX": 0,
        "--List-gap": "2px",
      }}
    >
      {titleResults.length > 0 ? (
        <Stack spacing={0.5}>
          <SearchSectionLabel>Conversations</SearchSectionLabel>
          {titleResults.map((conversation, resultIndex) => {
            const selected = selectedIndex === resultIndex;

            return (
              <ListItem key={conversation.id} sx={{ px: 1.5, py: 0.25 }}>
                <ListItemButton
                  id={`bloom-sidebar-result-${resultIndex}`}
                  aria-selected={selected || undefined}
                  onClick={() => onConversationClick(conversation)}
                  onMouseEnter={() => onSelectedIndexChange(resultIndex)}
                  sx={resultButtonSx(selected)}
                >
                  <Stack spacing={0.25} sx={{ minWidth: 0, width: "100%" }}>
                    <Typography
                      level="body-sm"
                      noWrap
                      sx={{ color: "common.white" }}
                    >
                      {conversation.title}
                    </Typography>
                    <Typography
                      level="body-xs"
                      noWrap
                      sx={{ color: "brandNavy.200" }}
                    >
                      {conversation.lastMessagePreview.trim() ||
                        "No messages yet"}
                    </Typography>
                  </Stack>
                </ListItemButton>
              </ListItem>
            );
          })}
        </Stack>
      ) : null}

      {messageResults.length > 0 ? (
        <Stack spacing={0.5}>
          <SearchSectionLabel>Messages</SearchSectionLabel>
          {messageResults.map((result, resultIndex) => {
            const navigationIndex = messageOffset + resultIndex;
            const selected = selectedIndex === navigationIndex;

            return (
              <ListItem key={result.messageId} sx={{ px: 1.5, py: 0.25 }}>
                <ListItemButton
                  id={`bloom-sidebar-result-${navigationIndex}`}
                  aria-selected={selected || undefined}
                  onClick={() => onMessageClick(result)}
                  onMouseEnter={() => onSelectedIndexChange(navigationIndex)}
                  sx={resultButtonSx(selected)}
                >
                  <Stack spacing={0.35} sx={{ minWidth: 0, width: "100%" }}>
                    <Typography
                      level="body-xs"
                      sx={{
                        color: "brandNavy.100",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {result.snippet.before}
                      <Typography
                        component="span"
                        level="body-xs"
                        sx={{ color: "primary.300", fontWeight: "lg" }}
                      >
                        {result.snippet.match}
                      </Typography>
                      {result.snippet.after}
                    </Typography>
                    <Typography
                      level="body-xs"
                      noWrap
                      sx={{ color: "brandNavy.300" }}
                    >
                      In: {result.conversationTitle} -{" "}
                      {formatResultDate(result.createdAt)}
                    </Typography>
                  </Stack>
                </ListItemButton>
              </ListItem>
            );
          })}
        </Stack>
      ) : null}
    </List>
  );
}
