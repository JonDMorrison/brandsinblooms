import Alert from "@mui/joy/Alert";
import Chip from "@mui/joy/Chip";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, CheckCircle2, Lightbulb, XCircle } from "lucide-react";
import { ImageValidationResult } from "@/lib/validation/imageValidation";

interface ValidationSummaryProps {
  validation: ImageValidationResult;
  imageCount: number;
  showOptimizations?: boolean;
  className?: string;
}

export function ValidationSummary({
  validation,
  imageCount,
  showOptimizations = true,
  className = "",
}: ValidationSummaryProps) {
  const hasErrors = validation.errors.length > 0;
  const hasWarnings = validation.warnings.length > 0;
  const hasOptimizations =
    showOptimizations && validation.optimizations.length > 0;

  if (!hasErrors && !hasWarnings && !hasOptimizations) {
    return (
      <Alert
        color="success"
        variant="soft"
        className={className}
        sx={{ borderRadius: "18px" }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <CheckCircle2 size={18} />
          <Typography level="body-sm">
            {imageCount === 0
              ? "Ready to add images"
              : `${imageCount} image${imageCount === 1 ? "" : "s"} validated successfully`}
          </Typography>
        </Stack>
      </Alert>
    );
  }

  return (
    <Stack spacing={1.25} className={className}>
      {hasErrors ? (
        <Alert
          color="danger"
          variant="soft"
          sx={{ borderRadius: "18px", alignItems: "flex-start" }}
        >
          <List sx={{ "--List-padding": "0px", gap: 0.5 }}>
            <ListItem sx={{ px: 0, py: 0, alignItems: "flex-start" }}>
              <ListItemDecorator
                sx={{ minWidth: 24, color: "danger.600", mt: 0.2 }}
              >
                <XCircle size={16} />
              </ListItemDecorator>
              <Stack spacing={0.5}>
                <Typography level="title-sm">
                  {`${validation.errors.length} error${validation.errors.length === 1 ? "" : "s"} found`}
                </Typography>
                {validation.errors.map((error) => (
                  <Typography key={error} level="body-sm">
                    {error}
                  </Typography>
                ))}
              </Stack>
            </ListItem>
          </List>
        </Alert>
      ) : null}

      {hasWarnings ? (
        <Alert
          color="warning"
          variant="soft"
          sx={{ borderRadius: "18px", alignItems: "flex-start" }}
        >
          <List sx={{ "--List-padding": "0px", gap: 0.5 }}>
            <ListItem sx={{ px: 0, py: 0, alignItems: "flex-start" }}>
              <ListItemDecorator
                sx={{ minWidth: 24, color: "warning.700", mt: 0.2 }}
              >
                <AlertTriangle size={16} />
              </ListItemDecorator>
              <Stack spacing={0.5}>
                <Typography level="title-sm">
                  {`${validation.warnings.length} warning${validation.warnings.length === 1 ? "" : "s"}`}
                </Typography>
                {validation.warnings.map((warning) => (
                  <Typography key={warning} level="body-sm">
                    {warning}
                  </Typography>
                ))}
              </Stack>
            </ListItem>
          </List>
        </Alert>
      ) : null}

      {hasOptimizations ? (
        <Alert
          color="primary"
          variant="soft"
          sx={{ borderRadius: "18px", alignItems: "flex-start" }}
        >
          <List sx={{ "--List-padding": "0px", gap: 0.5 }}>
            <ListItem sx={{ px: 0, py: 0, alignItems: "flex-start" }}>
              <ListItemDecorator
                sx={{ minWidth: 24, color: "primary.600", mt: 0.2 }}
              >
                <Lightbulb size={16} />
              </ListItemDecorator>
              <Stack spacing={0.75}>
                <Typography level="title-sm">
                  Optimization suggestions
                </Typography>
                <Stack
                  direction="row"
                  spacing={0.75}
                  useFlexGap
                  flexWrap="wrap"
                >
                  {validation.optimizations.map((optimization) => (
                    <Chip
                      key={optimization}
                      size="sm"
                      variant="soft"
                      color="primary"
                    >
                      {optimization}
                    </Chip>
                  ))}
                </Stack>
              </Stack>
            </ListItem>
          </List>
        </Alert>
      ) : null}
    </Stack>
  );
}
