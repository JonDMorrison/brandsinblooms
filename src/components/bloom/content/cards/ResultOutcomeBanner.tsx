import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { JoyChip } from "@/components/joy/JoyChip";
import type {
  MutationResultState,
  ResultCardTone,
} from "@/components/bloom/content/cards/cardUtils";

const toneByState: Record<MutationResultState, ResultCardTone> = {
  created: "success",
  updated: "success",
  deleted: "danger",
  duplicate_found: "warning",
};

const iconByState = {
  created: Plus,
  updated: Pencil,
  deleted: Trash2,
  duplicate_found: AlertTriangle,
};

function labelForState(state: MutationResultState, entityLabel: string) {
  switch (state) {
    case "created":
      return "Created successfully";
    case "updated":
      return "Updated successfully";
    case "deleted":
      return "Deleted";
    case "duplicate_found":
      return `Duplicate ${entityLabel} found`;
  }
}

export function ResultOutcomeBanner({
  entityLabel,
  message,
  state,
}: {
  entityLabel: string;
  message?: string | null;
  state: MutationResultState;
}) {
  const tone = toneByState[state];
  const Icon = iconByState[state];

  return (
    <Sheet
      variant="soft"
      color="neutral"
      sx={{
        border: "1px solid",
        borderColor: "neutral.outlinedBorder",
        borderRadius: "var(--joy-radius-md)",
        backgroundColor: "background.level1",
        px: 1,
        py: 0.875,
      }}
    >
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box
            sx={{
              display: "inline-flex",
              color: `${tone}.600`,
              flexShrink: 0,
            }}
          >
            <Icon size={14} strokeWidth={1.9} />
          </Box>
          <JoyChip color={tone} size="sm" variant="soft">
            {labelForState(state, entityLabel)}
          </JoyChip>
        </Stack>
        {message ? (
          <Typography
            level="body-xs"
            sx={{ color: "neutral.600", overflowWrap: "anywhere" }}
          >
            {message}
          </Typography>
        ) : null}
      </Stack>
    </Sheet>
  );
}
