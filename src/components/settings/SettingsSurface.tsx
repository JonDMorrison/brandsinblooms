import type { ReactNode } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, type LucideIcon } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";

type SettingsActionVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "destructiveOutline"
  | "cta"
  | "link";

type SettingsActionColor =
  | "primary"
  | "neutral"
  | "danger"
  | "success"
  | "warning";

interface SettingsActionConfig {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  startDecorator?: ReactNode;
  variant?: SettingsActionVariant;
  color?: SettingsActionColor;
}

interface SettingsSectionCardProps {
  title: string;
  description: string;
  children: ReactNode;
  startDecorator?: ReactNode;
  headerActions?: ReactNode;
}

interface SettingsEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction?: SettingsActionConfig;
  secondaryAction?: SettingsActionConfig;
}

interface SettingsInlineErrorProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const settingsPanelSx = {
  borderRadius: "24px",
  borderColor: "neutral.200",
  boxShadow: "none",
  bgcolor: "background.surface",
  p: { xs: 2.5, md: 3 },
};

export const SettingsSectionCard = ({
  title,
  description,
  children,
  startDecorator,
  headerActions,
}: SettingsSectionCardProps) => {
  return (
    <Sheet variant="outlined" sx={settingsPanelSx}>
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "flex-start" }}
        >
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            {startDecorator ? (
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "16px",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "background.level1",
                  color: "text.secondary",
                  flexShrink: 0,
                }}
              >
                {startDecorator}
              </Box>
            ) : null}

            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              <Typography level="title-md">{title}</Typography>
              <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                {description}
              </Typography>
            </Stack>
          </Stack>

          {headerActions ? (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ flexShrink: 0 }}
            >
              {headerActions}
            </Stack>
          ) : null}
        </Stack>

        {children}
      </Stack>
    </Sheet>
  );
};

const renderActionButton = (action?: SettingsActionConfig) => {
  if (!action) {
    return null;
  }

  return (
    <JoyButton
      color={action.color}
      disabled={action.disabled}
      loading={action.loading}
      onClick={action.onClick}
      startDecorator={action.startDecorator}
      variant={action.variant}
    >
      {action.label}
    </JoyButton>
  );
};

export const SettingsEmptyState = ({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: SettingsEmptyStateProps) => {
  return (
    <Stack
      spacing={1.25}
      alignItems="center"
      justifyContent="center"
      sx={{ minHeight: 220, px: 3, textAlign: "center" }}
    >
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: "18px",
          display: "grid",
          placeItems: "center",
          bgcolor: "background.level1",
          color: "text.tertiary",
        }}
      >
        <Icon size={24} strokeWidth={1.8} />
      </Box>
      <Typography level="title-sm">{title}</Typography>
      <Typography level="body-sm" sx={{ color: "text.secondary", maxWidth: 520 }}>
        {description}
      </Typography>

      {primaryAction || secondaryAction ? (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
          {renderActionButton(primaryAction)}
          {renderActionButton(secondaryAction)}
        </Stack>
      ) : null}
    </Stack>
  );
};

export const SettingsInlineError = ({
  message,
  onRetry,
  retryLabel = "Retry",
}: SettingsInlineErrorProps) => {
  return (
    <Alert
      color="danger"
      size="sm"
      startDecorator={<AlertTriangle size={16} />}
      variant="soft"
      endDecorator={
        onRetry ? (
          <JoyButton color="neutral" onClick={onRetry} size="sm" variant="outline">
            {retryLabel}
          </JoyButton>
        ) : undefined
      }
    >
      {message}
    </Alert>
  );
};