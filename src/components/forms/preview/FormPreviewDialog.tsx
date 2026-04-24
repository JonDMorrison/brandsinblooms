import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import ToggleButtonGroup from "@mui/joy/ToggleButtonGroup";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { normalizeFormSettings } from "@/lib/forms/designSettings";
import {
  DEFAULT_FORM_COMPLIANCE,
  type FormCompliance,
  type FormField,
  type FormSettings,
} from "@/types/formBuilder";
import { FormPreviewRenderer } from "./FormPreviewRenderer";

type PreviewDevice = "desktop" | "tablet" | "phone";
type PreviewBackground = "canvas" | "paper" | "ink";

interface FormPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: FormField[];
  settings: FormSettings | null;
  compliance: FormCompliance | null;
  formName: string;
  uploadEmbedKey?: string;
}

const DEVICE_WIDTHS: Record<PreviewDevice, number> = {
  desktop: 1180,
  tablet: 820,
  phone: 420,
};

const DEVICE_OPTIONS: Array<{
  value: PreviewDevice;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "desktop", label: "Desktop", icon: <Monitor size={16} /> },
  { value: "tablet", label: "Tablet", icon: <Tablet size={16} /> },
  { value: "phone", label: "Phone", icon: <Smartphone size={16} /> },
];

const BACKGROUND_OPTIONS: Array<{
  value: PreviewBackground;
  label: string;
}> = [
  { value: "canvas", label: "Canvas" },
  { value: "paper", label: "Paper" },
  { value: "ink", label: "Ink" },
];

function getBackgroundSx(background: PreviewBackground) {
  switch (background) {
    case "paper":
      return {
        backgroundColor: "#fffaf1",
        backgroundImage:
          "radial-gradient(circle at top, rgba(214, 197, 167, 0.16), transparent 54%)",
      };
    case "ink":
      return {
        backgroundColor: "#0f172a",
        backgroundImage:
          "radial-gradient(circle at top, rgba(34, 197, 94, 0.18), transparent 42%)",
      };
    case "canvas":
    default:
      return {
        backgroundColor: "#f6f3ee",
        backgroundImage:
          "linear-gradient(135deg, rgba(15, 23, 42, 0.03), transparent 40%), radial-gradient(circle at top right, rgba(34, 197, 94, 0.12), transparent 36%)",
      };
  }
}

export function FormPreviewDialog({
  open,
  onOpenChange,
  fields,
  settings,
  compliance,
  formName,
  uploadEmbedKey,
}: FormPreviewDialogProps) {
  const [device, setDevice] = React.useState<PreviewDevice>("desktop");
  const [background, setBackground] =
    React.useState<PreviewBackground>("canvas");
  const [resetSignal, setResetSignal] = React.useState(0);

  const resolvedSettings = React.useMemo(
    () => normalizeFormSettings(settings),
    [settings],
  );
  const resolvedCompliance = React.useMemo(
    () => ({ ...DEFAULT_FORM_COMPLIANCE, ...compliance }),
    [compliance],
  );
  const previewWidth = DEVICE_WIDTHS[device];
  const warnings = React.useMemo(() => {
    const nextWarnings: string[] = [];

    if (fields.length === 0) {
      nextWarnings.push(
        "Add at least one field to preview the submission flow.",
      );
    }

    if (!fields.some((field) => field.type === "email")) {
      nextWarnings.push(
        "No email field detected. Most capture forms should collect one.",
      );
    }

    return nextWarnings;
  }, [fields]);

  return (
    <JoyDialog
      open={open}
      onClose={() => onOpenChange(false)}
      size="xl"
      title={formName || "Form preview"}
      description="Review the live form runtime across device sizes before publishing."
      startDecorator={
        <Avatar size="sm" variant="soft" color="primary">
          <Monitor size={18} />
        </Avatar>
      }
      dialogSx={{ maxWidth: 1200, width: "calc(100vw - 1.5rem)" }}
    >
      <JoyDialogContent
        sx={{ pt: 0, display: "flex", flexDirection: "column", gap: 2 }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", lg: "center" }}
        >
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap>
            <ToggleButtonGroup
              size="sm"
              value={device}
              onChange={(_event, value) => {
                if (value) {
                  setDevice(value);
                }
              }}
              sx={{
                borderRadius: "lg",
                border: "1px solid",
                borderColor: "neutral.200",
                backgroundColor: "background.surface",
              }}
            >
              {DEVICE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  value={option.value}
                  variant={device === option.value ? "solid" : "plain"}
                  color={device === option.value ? "primary" : "neutral"}
                  startDecorator={option.icon}
                >
                  {option.label}
                </Button>
              ))}
            </ToggleButtonGroup>

            <ToggleButtonGroup
              size="sm"
              value={background}
              onChange={(_event, value) => {
                if (value) {
                  setBackground(value);
                }
              }}
              sx={{
                borderRadius: "lg",
                border: "1px solid",
                borderColor: "neutral.200",
                backgroundColor: "background.surface",
              }}
            >
              {BACKGROUND_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  value={option.value}
                  variant={background === option.value ? "solid" : "plain"}
                  color={background === option.value ? "primary" : "neutral"}
                >
                  {option.label}
                </Button>
              ))}
            </ToggleButtonGroup>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <JoyChip size="sm" variant="soft" color="neutral">
              {fields.length} fields
            </JoyChip>
            <JoyButton
              bloomVariant="ghost"
              color="neutral"
              startDecorator={<RefreshCw size={16} />}
              onClick={() => setResetSignal((value) => value + 1)}
            >
              Reset preview
            </JoyButton>
          </Stack>
        </Stack>

        {warnings.length > 0 ? (
          <Sheet
            variant="soft"
            color="warning"
            sx={{ borderRadius: "lg", p: 2 }}
          >
            <Stack spacing={1}>
              {warnings.map((warning) => (
                <Stack
                  key={warning}
                  direction="row"
                  spacing={1}
                  alignItems="flex-start"
                >
                  <AlertTriangle size={16} />
                  <Typography level="body-sm">{warning}</Typography>
                </Stack>
              ))}
            </Stack>
          </Sheet>
        ) : null}

        <Sheet
          variant="plain"
          sx={{
            ...getBackgroundSx(background),
            borderRadius: "xl",
            minHeight: 560,
            px: { xs: 1.5, md: 3 },
            py: { xs: 2, md: 3 },
            overflow: "auto",
          }}
        >
          <Box
            sx={{
              width: "100%",
              minWidth: previewWidth,
              maxWidth: previewWidth,
              marginInline: "auto",
              transition: "max-width 180ms ease, min-width 180ms ease",
            }}
          >
            <FormPreviewRenderer
              key={resetSignal}
              fields={fields}
              settings={resolvedSettings}
              compliance={resolvedCompliance}
              uploadEmbedKey={uploadEmbedKey}
            />
          </Box>
        </Sheet>
      </JoyDialogContent>
      <JoyDialogActions>
        <JoyButton
          bloomVariant="ghost"
          color="neutral"
          onClick={() => onOpenChange(false)}
        >
          Close
        </JoyButton>
      </JoyDialogActions>
    </JoyDialog>
  );
}
