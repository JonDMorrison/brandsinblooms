import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Divider from "@mui/joy/Divider";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { FileText, Plus, Sparkles } from "lucide-react";
import { JoyChip } from "@/components/joy/JoyChip";
import { FORM_TEMPLATES, createFormFromTemplate } from "@/lib/formTemplates";
import type { FormField, FormTemplate } from "@/types/formBuilder";

type TemplateSelection = ReturnType<typeof createFormFromTemplate> & {
  name: string;
};

interface FormTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (templateData: TemplateSelection) => void | Promise<void>;
  onStartFromScratch?: () => void | Promise<void>;
  isCreating?: boolean;
}

function getFieldSummaryLabel(field: FormField): string {
  switch (field.type) {
    case "email":
      return "Email";
    case "phone":
      return "Phone";
    case "file":
      return "File upload";
    case "email_consent":
      return "Consent";
    case "sms_consent":
      return "SMS consent";
    case "segment_checkbox":
      return field.segment_name || field.label;
    default:
      return field.label;
  }
}

function getTemplateFieldSummary(template: FormTemplate): string {
  return template.fields
    .map(getFieldSummaryLabel)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(", ");
}

function TemplateCardSkeleton() {
  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        p: 2,
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Skeleton variant="text" width={132} height={22} animation="wave" />
          <Skeleton
            variant="rectangular"
            width={72}
            height={24}
            animation="wave"
            sx={{ borderRadius: 999 }}
          />
        </Stack>
        <Skeleton variant="text" width="86%" height={18} animation="wave" />
        <Skeleton variant="text" width="72%" height={18} animation="wave" />
        <Stack direction="row" spacing={1}>
          <Skeleton
            variant="rectangular"
            width={78}
            height={24}
            animation="wave"
            sx={{ borderRadius: 999 }}
          />
          <Skeleton
            variant="rectangular"
            width={92}
            height={24}
            animation="wave"
            sx={{ borderRadius: 999 }}
          />
        </Stack>
      </Stack>
    </Sheet>
  );
}

export function FormTemplatesDialog({
  open,
  onOpenChange,
  onSelect,
  onStartFromScratch,
  isCreating = false,
}: FormTemplatesDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<
    string | null
  >(null);
  const [isBootstrapping, setIsBootstrapping] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedTemplateId(null);
    setIsBootstrapping(true);

    const frameId = window.requestAnimationFrame(() => {
      setIsBootstrapping(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [open]);

  const selectedTemplate = React.useMemo(
    () =>
      FORM_TEMPLATES.find((template) => template.id === selectedTemplateId) ??
      null,
    [selectedTemplateId],
  );

  const handleUseSelectedTemplate = React.useCallback(() => {
    if (!selectedTemplate) {
      return;
    }

    const formData = createFormFromTemplate(selectedTemplate);
    void onSelect({
      name: selectedTemplate.name,
      ...formData,
    });
  }, [onSelect, selectedTemplate]);

  return (
    <Modal open={open} onClose={() => onOpenChange(false)}>
      <ModalDialog
        sx={{
          width: "min(100%, 1040px)",
          maxWidth: 1040,
          borderRadius: "var(--joy-radius-lg)",
          p: 0,
          overflow: "hidden",
          bgcolor: "background.surface",
        }}
      >
        <ModalClose />

        <Stack spacing={0}>
          <Box sx={{ px: { xs: 2.25, md: 3 }, py: { xs: 2.25, md: 2.5 } }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "primary.50",
                      color: "primary.600",
                    }}
                  >
                    <Sparkles size={18} />
                  </Box>
                  <Typography level="title-lg">
                    Start with a template
                  </Typography>
                </Stack>
                <Typography level="body-sm" color="neutral">
                  Pick a proven starting point, then refine the fields, styling,
                  and publish settings in the editor.
                </Typography>
              </Stack>

              {onStartFromScratch ? (
                <Button
                  size="sm"
                  variant="plain"
                  color="neutral"
                  startDecorator={<Plus size={15} />}
                  disabled={isCreating}
                  onClick={() => {
                    void onStartFromScratch();
                  }}
                >
                  Create blank form
                </Button>
              ) : null}
            </Stack>
          </Box>

          <Divider />

          <Stack
            spacing={2.5}
            sx={{ px: { xs: 2.25, md: 3 }, py: { xs: 2.25, md: 2.5 } }}
          >
            {isBootstrapping ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                    xl: "repeat(3, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                {Array.from({ length: Math.max(3, FORM_TEMPLATES.length) }).map(
                  (_, index) => (
                    <TemplateCardSkeleton key={index} />
                  ),
                )}
              </Box>
            ) : (
              <>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "repeat(2, minmax(0, 1fr))",
                      xl: "repeat(3, minmax(0, 1fr))",
                    },
                    gap: 2,
                  }}
                >
                  {FORM_TEMPLATES.map((template) => {
                    const selected = template.id === selectedTemplateId;

                    return (
                      <Sheet
                        key={template.id}
                        variant="outlined"
                        onClick={() => setSelectedTemplateId(template.id)}
                        sx={{
                          borderRadius: "var(--joy-radius-lg)",
                          borderColor: selected ? "primary.400" : "neutral.200",
                          backgroundColor: selected
                            ? "primary.50"
                            : "background.surface",
                          boxShadow: selected
                            ? "0 0 0 1px rgba(var(--joy-palette-primary-mainChannel) / 0.2)"
                            : "none",
                          p: 2,
                          cursor: "pointer",
                          transition:
                            "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
                          "&:hover": {
                            borderColor: selected
                              ? "primary.500"
                              : "neutral.300",
                            transform: "translateY(-1px)",
                          },
                        }}
                      >
                        <Stack spacing={1.4}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            spacing={1.5}
                          >
                            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                              <Typography level="title-sm">
                                {template.name}
                              </Typography>
                              <Typography
                                level="body-sm"
                                color="neutral"
                                sx={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                  minHeight: 40,
                                }}
                              >
                                {template.description}
                              </Typography>
                            </Stack>
                            <Box
                              sx={{
                                width: 36,
                                height: 36,
                                borderRadius: 999,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                bgcolor: selected
                                  ? "primary.100"
                                  : "neutral.100",
                                color: selected ? "primary.600" : "neutral.500",
                                flexShrink: 0,
                              }}
                            >
                              <FileText size={18} />
                            </Box>
                          </Stack>

                          <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            flexWrap="wrap"
                          >
                            <JoyChip size="sm" variant="soft" color="neutral">
                              {template.fields.length} fields
                            </JoyChip>
                            <JoyChip
                              size="sm"
                              variant="outlined"
                              color="neutral"
                            >
                              {template.category}
                            </JoyChip>
                          </Stack>
                        </Stack>
                      </Sheet>
                    );
                  })}
                </Box>

                <Sheet
                  variant="soft"
                  sx={{
                    borderRadius: "var(--joy-radius-lg)",
                    px: 2,
                    py: 1.75,
                    bgcolor: "background.level1",
                  }}
                >
                  <Stack spacing={0.4}>
                    <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                      {selectedTemplate
                        ? `This template includes: ${getTemplateFieldSummary(selectedTemplate)}`
                        : "Select a template to review its included fields."}
                    </Typography>
                    {selectedTemplate ? (
                      <Typography level="body-xs" color="neutral">
                        Starts with {selectedTemplate.fields.length} fields and
                        the {selectedTemplate.category.toLowerCase()} category
                        defaults.
                      </Typography>
                    ) : null}
                  </Stack>
                </Sheet>
              </>
            )}
          </Stack>

          <Divider />

          <Stack
            direction={{ xs: "column-reverse", sm: "row" }}
            spacing={1}
            justifyContent="space-between"
            sx={{ px: { xs: 2.25, md: 3 }, py: { xs: 2, md: 2.25 } }}
          >
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              {onStartFromScratch ? (
                <Button
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  startDecorator={<Plus size={15} />}
                  disabled={isCreating}
                  onClick={() => {
                    void onStartFromScratch();
                  }}
                >
                  Create blank form
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="plain"
                color="neutral"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            </Stack>

            <Button
              size="sm"
              variant="solid"
              color="primary"
              disabled={!selectedTemplate || isCreating}
              loading={isCreating}
              onClick={handleUseSelectedTemplate}
            >
              Use this template
            </Button>
          </Stack>
        </Stack>
      </ModalDialog>
    </Modal>
  );
}
