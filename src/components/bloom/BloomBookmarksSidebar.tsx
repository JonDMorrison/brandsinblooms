import * as React from "react";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import ListItemButton from "@mui/joy/ListItemButton";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { BookmarkedMessage } from "@/hooks/bloom/useBloomBookmarks";

interface BloomBookmarksSidebarProps {
  bookmarks: BookmarkedMessage[];
  isLoading: boolean;
  onBookmarkClick: (conversationId: string, messageId: string) => void;
}

type BookmarkSection = {
  label: string;
  bookmarks: BookmarkedMessage[];
};

const startOfDay = (date: Date) => {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const dayDifference = (value: string) => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return Number.POSITIVE_INFINITY;
  }

  const today = startOfDay(new Date()).getTime();
  const target = startOfDay(new Date(timestamp)).getTime();
  return Math.floor((today - target) / 86_400_000);
};

const sectionLabel = (value: string) => {
  const difference = dayDifference(value);
  if (difference <= 0) {
    return "Today";
  }
  if (difference === 1) {
    return "Yesterday";
  }
  if (difference <= 7) {
    return "Last 7 Days";
  }
  if (difference <= 30) {
    return "Last 30 Days";
  }
  return "Older";
};

const formatTimestamp = (value: string) =>
  new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const previewText = (bookmark: BookmarkedMessage) =>
  (bookmark.contentPreview || "Saved Bloom response").slice(0, 80);

const groupedBookmarks = (bookmarks: BookmarkedMessage[]) => {
  const sections = new Map<string, BookmarkedMessage[]>();

  bookmarks.forEach((bookmark) => {
    const label = sectionLabel(bookmark.createdAt);
    sections.set(label, [...(sections.get(label) ?? []), bookmark]);
  });

  return Array.from(sections.entries()).map<BookmarkSection>(
    ([label, sectionBookmarks]) => ({ label, bookmarks: sectionBookmarks }),
  );
};

function BookmarkSkeletons() {
  return (
    <Stack spacing={1} sx={{ px: 1.5, py: 0.5 }}>
      {Array.from({ length: 3 }).map((_, index) => (
        <Stack key={index} spacing={0.5} sx={{ px: 1.25, py: 1 }}>
          <Skeleton
            animation="wave"
            variant="text"
            sx={{ bgcolor: "brandNavy.700", width: "86%" }}
          />
          <Skeleton
            animation="wave"
            variant="text"
            sx={{ bgcolor: "brandNavy.700", width: "62%" }}
          />
        </Stack>
      ))}
    </Stack>
  );
}

export function BloomBookmarksSidebar({
  bookmarks,
  isLoading,
  onBookmarkClick,
}: BloomBookmarksSidebarProps) {
  const sections = React.useMemo(
    () => groupedBookmarks(bookmarks),
    [bookmarks],
  );

  if (isLoading) {
    return <BookmarkSkeletons />;
  }

  if (bookmarks.length === 0) {
    return (
      <Typography
        level="body-xs"
        sx={{ px: 3, py: 1.25, color: "brandNavy.200" }}
      >
        No saved messages yet
      </Typography>
    );
  }

  return (
    <List
      size="sm"
      sx={{
        "--ListItem-paddingY": 0,
        "--ListItem-paddingX": 0,
        "--List-gap": "2px",
        pb: 1,
      }}
    >
      {sections.map((section) => (
        <Stack key={section.label} spacing={0.5}>
          <Typography
            level="body-xs"
            sx={{ px: 3, pt: 1, pb: 0.25, color: "brandNavy.300" }}
          >
            {section.label}
          </Typography>
          {section.bookmarks.map((bookmark) => (
            <ListItem key={bookmark.messageId} sx={{ px: 1.5, py: 0.25 }}>
              <ListItemButton
                onClick={() =>
                  onBookmarkClick(bookmark.conversationId, bookmark.messageId)
                }
                sx={{
                  width: "100%",
                  minHeight: 68,
                  alignItems: "flex-start",
                  borderRadius: "var(--joy-radius-md)",
                  color: "common.white",
                  px: 1.25,
                  py: 0.85,
                  "&:hover": { backgroundColor: "brandNavy.700" },
                  "&.Mui-focusVisible, &:focus-visible": {
                    outline: 0,
                    boxShadow:
                      "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.22)",
                  },
                }}
              >
                <Stack spacing={0.3} sx={{ minWidth: 0, width: "100%" }}>
                  <Typography
                    level="body-xs"
                    noWrap
                    sx={{ color: "common.white" }}
                  >
                    {previewText(bookmark)}
                  </Typography>
                  <Typography
                    level="body-xs"
                    noWrap
                    sx={{ color: "brandNavy.200" }}
                  >
                    In: {bookmark.conversationTitle}
                  </Typography>
                  <Typography
                    level="body-xs"
                    noWrap
                    sx={{ color: "brandNavy.300" }}
                  >
                    {formatTimestamp(bookmark.createdAt)}
                  </Typography>
                </Stack>
              </ListItemButton>
            </ListItem>
          ))}
        </Stack>
      ))}
    </List>
  );
}
