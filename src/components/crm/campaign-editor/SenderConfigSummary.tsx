import * as React from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyButton } from "@/components/joy/JoyButton";

export interface SenderConfigSummaryProps {
  senderDisplayName: string;
  senderEmail: string;
  isVerified: boolean;
  isLocked?: boolean;
  onEdit: () => void;
}

export function SenderConfigSummary({
  senderDisplayName,
  senderEmail,
  isVerified,
  isLocked = false,
  onEdit,
}: SenderConfigSummaryProps) {
  const trimmedDisplayName = senderDisplayName.trim();
  const trimmedEmail = senderEmail.trim();

  if (!trimmedEmail) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          py: 0.5,
        }}
      >
        <JoyButton
          variant="plain"
          color="primary"
          size="sm"
          onClick={onEdit}
          disabled={isLocked}
          data-testid="sender-config-summary-configure"
        >
          Configure sender →
        </JoyButton>
      </Box>
    );
  }

  const formattedFrom = trimmedDisplayName
    ? `${trimmedDisplayName} <${trimmedEmail}>`
    : trimmedEmail;

  return (
    <Box
      data-testid="sender-config-summary"
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 1,
        py: 0.5,
      }}
    >
      <Typography
        component="span"
        level="body-sm"
        sx={{ color: "neutral.600" }}
      >
        From:
      </Typography>
      <Typography
        component="span"
        level="body-sm"
        fontWeight="md"
        sx={{
          color: "neutral.800",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {formattedFrom}
      </Typography>
      <Chip
        variant="soft"
        color={isVerified ? "success" : "warning"}
        size="sm"
        data-testid={
          isVerified
            ? "sender-config-summary-verified"
            : "sender-config-summary-unverified"
        }
      >
        {isVerified ? "Verified" : "Unverified"}
      </Chip>
      <Stack direction="row" spacing={0.5} sx={{ ml: "auto" }}>
        <JoyButton
          variant="plain"
          color="neutral"
          size="sm"
          onClick={onEdit}
          disabled={isLocked}
          data-testid="sender-config-summary-edit"
        >
          Edit
        </JoyButton>
      </Stack>
    </Box>
  );
}
