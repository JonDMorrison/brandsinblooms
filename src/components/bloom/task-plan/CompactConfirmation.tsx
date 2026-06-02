import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { CheckCircle } from "lucide-react";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";

export interface CompactConfirmationProps {
  entityName: string;
  fieldName: string;
  currentValue: string;
  newValue: string;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting: boolean;
  isComplete?: boolean;
}

export function CompactConfirmation({
  currentValue,
  entityName,
  fieldName,
  isComplete = false,
  isExecuting,
  newValue,
  onCancel,
  onConfirm,
}: CompactConfirmationProps) {
  const reducedMotion = useBloomReducedMotion();

  return (
    <JoyCard
      variant="outlined"
      sx={{
        width: "100%",
        p: 1.5,
        transition: reducedMotion
          ? "none"
          : "opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.25}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
      >
        <Box sx={{ minWidth: 0 }}>
          {isComplete ? (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ minWidth: 0 }}
            >
              <JoyChip
                color="success"
                size="sm"
                variant="soft"
                startDecorator={<CheckCircle size={14} />}
              >
                Updated
              </JoyChip>
              <Typography
                level="body-sm"
                sx={{ color: "neutral.800", overflowWrap: "anywhere" }}
              >
                {entityName} {fieldName} is now {newValue}
              </Typography>
            </Stack>
          ) : (
            <Typography
              level="body-sm"
              sx={{ color: "neutral.800", overflowWrap: "anywhere" }}
            >
              Update{" "}
              <Typography component="span" fontWeight="lg">
                {entityName}
              </Typography>{" "}
              {fieldName} from {currentValue} to {newValue}?
            </Typography>
          )}
        </Box>

        {isComplete ? null : (
          <Stack
            direction="row"
            spacing={1}
            justifyContent={{ xs: "flex-end", sm: "flex-start" }}
          >
            <JoyButton
              color="primary"
              disabled={isExecuting}
              loading={isExecuting}
              size="sm"
              variant="solid"
              onClick={onConfirm}
            >
              Confirm
            </JoyButton>
            <JoyButton
              color="neutral"
              disabled={isExecuting}
              size="sm"
              variant="plain"
              onClick={onCancel}
            >
              Cancel
            </JoyButton>
          </Stack>
        )}
      </Stack>
    </JoyCard>
  );
}
