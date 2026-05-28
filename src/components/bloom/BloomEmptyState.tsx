import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Archive, Plus, Search } from "lucide-react";
import { BloomAvatar } from "@/components/bloom/BloomAvatar";
import { JoyButton } from "@/components/joy/JoyButton";

export type BloomEmptyStateVariant =
  | "no-conversations"
  | "no-results"
  | "all-archived";

interface BloomEmptyStateProps {
  variant: BloomEmptyStateVariant;
  onCreate?: () => void;
  onShowArchived?: () => void;
}

const emptyStateCopy: Record<
  BloomEmptyStateVariant,
  { title: string; description: string }
> = {
  "no-conversations": {
    title: "Start your first conversation",
    description:
      "Ask Bloom about your business, create campaigns, or analyze data",
  },
  "no-results": {
    title: "No conversations found",
    description: "Try different search terms",
  },
  "all-archived": {
    title: "All conversations archived",
    description: "Show archived conversations or start a new chat",
  },
};

const iconSx = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "brandNavy.100",
  backgroundColor: "brandNavy.700",
};

export function BloomEmptyState({
  variant,
  onCreate,
  onShowArchived,
}: BloomEmptyStateProps) {
  const copy = emptyStateCopy[variant];
  const showAvatar = variant === "no-conversations";

  return (
    <Stack
      spacing={2}
      alignItems="center"
      justifyContent="center"
      sx={{ minHeight: 260, px: 3, textAlign: "center" }}
    >
      {showAvatar ? (
        <BloomAvatar size="md" />
      ) : (
        <Stack sx={iconSx} aria-hidden="true">
          {variant === "no-results" ? (
            <Search size={20} strokeWidth={1.9} />
          ) : (
            <Archive size={20} strokeWidth={1.9} />
          )}
        </Stack>
      )}

      <Stack spacing={0.5} alignItems="center">
        <Typography level="title-sm" sx={{ color: "common.white" }}>
          {copy.title}
        </Typography>
        <Typography level="body-xs" sx={{ color: "brandNavy.200" }}>
          {copy.description}
        </Typography>
      </Stack>

      {variant === "all-archived" ? (
        <Stack direction="row" spacing={1} justifyContent="center" useFlexGap>
          <JoyButton
            size="sm"
            variant="soft"
            color="neutral"
            startDecorator={<Archive size={16} strokeWidth={1.9} />}
            onClick={onShowArchived}
            sx={{ color: "common.white", backgroundColor: "brandNavy.700" }}
          >
            Show Archived
          </JoyButton>
          <JoyButton
            size="sm"
            variant="outlined"
            color="neutral"
            startDecorator={<Plus size={16} strokeWidth={1.9} />}
            onClick={onCreate}
            sx={{ color: "common.white", borderColor: "brandNavy.500" }}
          >
            New Chat
          </JoyButton>
        </Stack>
      ) : variant === "no-conversations" ? (
        <JoyButton
          size="sm"
          variant="outlined"
          color="neutral"
          startDecorator={<Plus size={16} strokeWidth={1.9} />}
          onClick={onCreate}
          sx={{ color: "common.white", borderColor: "brandNavy.500" }}
        >
          New Chat
        </JoyButton>
      ) : null}
    </Stack>
  );
}
