import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Grid from "@mui/joy/Grid";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowRight, FileText, Plus, Sparkles } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import {
  FORM_TEMPLATES,
  createFormFromTemplate,
  getTemplateFieldPreview,
} from "@/lib/formTemplates";

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

export function FormTemplatesDialog({
  open,
  onOpenChange,
  onSelect,
  onStartFromScratch,
  isCreating = false,
}: FormTemplatesDialogProps) {
  const handleSelect = (templateId: string) => {
    const template = FORM_TEMPLATES.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    const formData = createFormFromTemplate(template);
    void onSelect({
      name: template.name,
      ...formData,
    });
  };

  return (
    <JoyDialog
      open={open}
      onClose={() => onOpenChange(false)}
      size="xl"
      title="Create a form"
      description="Start from scratch or pick a polished template for a common lead capture flow."
      startDecorator={
        <Avatar size="sm" variant="soft" color="primary">
          <Sparkles size={18} />
        </Avatar>
      }
    >
      <JoyDialogContent sx={{ pt: 0 }}>
        <Stack spacing={3}>
          <Grid container spacing={2}>
            {onStartFromScratch ? (
              <Grid xs={12} md={4}>
                <JoyCard
                  interactive
                  onClick={() => void onStartFromScratch()}
                  sx={{
                    minHeight: 228,
                    borderStyle: "dashed",
                    borderColor: "primary.200",
                    backgroundColor: "primary.50",
                    "&:hover": {
                      borderColor: "primary.300",
                    },
                  }}
                >
                  <JoyCardHeader
                    startDecorator={
                      <Avatar size="sm" variant="soft" color="primary">
                        <Plus size={18} />
                      </Avatar>
                    }
                    title="Start from scratch"
                    description="Begin with a clean draft and a single required email field."
                    actions={
                      <JoyChip size="sm" variant="soft" color="primary">
                        Recommended
                      </JoyChip>
                    }
                  />
                  <JoyCardContent sx={{ pt: 3, gap: 2, mt: "auto" }}>
                    <Typography level="body-sm" color="neutral">
                      Best when you already know the exact flow and want to
                      tailor every field yourself.
                    </Typography>
                    <JoyButton
                      disabled={isCreating}
                      onClick={(event) => {
                        event.stopPropagation();
                        void onStartFromScratch();
                      }}
                    >
                      {isCreating ? "Creating form..." : "Start from scratch"}
                    </JoyButton>
                  </JoyCardContent>
                </JoyCard>
              </Grid>
            ) : null}

            <Grid xs={12} md={onStartFromScratch ? 8 : 12}>
              <JoyCard sx={{ minHeight: 228 }}>
                <JoyCardHeader
                  startDecorator={
                    <Avatar size="sm" variant="soft" color="neutral">
                      <FileText size={18} />
                    </Avatar>
                  }
                  title="Template library"
                  description="Choose a proven starting point, then refine the structure, design, and publishing settings in the editor."
                  actions={
                    <JoyChip size="sm" variant="outlined" color="neutral">
                      {FORM_TEMPLATES.length} templates
                    </JoyChip>
                  }
                />
                <JoyCardContent sx={{ pt: 3, gap: 2 }}>
                  <Typography level="body-sm" color="neutral">
                    Templates include form structure, initial messaging, and
                    consent defaults tuned for common CRM capture scenarios.
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(3, minmax(0, 1fr))",
                      },
                      gap: 1.5,
                    }}
                  >
                    {FORM_TEMPLATES.slice(0, 3).map((template) => (
                      <Box
                        key={template.id}
                        sx={{
                          border: "1px solid",
                          borderColor: "neutral.200",
                          borderRadius: "md",
                          px: 2,
                          py: 1.5,
                        }}
                      >
                        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                          {template.name}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          {template.description}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </JoyCardContent>
              </JoyCard>
            </Grid>
          </Grid>

          <Divider />

          <Stack spacing={1.5}>
            <Typography level="title-sm">Templates</Typography>
            <Grid container spacing={2}>
              {FORM_TEMPLATES.map((template) => (
                <Grid key={template.id} xs={12} md={6}>
                  <JoyCard
                    interactive
                    onClick={() => handleSelect(template.id)}
                    sx={{ minHeight: 228 }}
                  >
                    <JoyCardHeader
                      title={template.name}
                      description={template.description}
                      actions={
                        <JoyChip size="sm" variant="outlined" color="neutral">
                          {template.category}
                        </JoyChip>
                      }
                    />
                    <JoyCardContent sx={{ pt: 3, gap: 2, mt: "auto" }}>
                      <Box
                        sx={{
                          borderRadius: "md",
                          backgroundColor: "neutral.50",
                          px: 2,
                          py: 1.5,
                        }}
                      >
                        <Typography level="body-sm" color="neutral">
                          {getTemplateFieldPreview(template)}
                        </Typography>
                      </Box>
                      <JoyButton
                        disabled={isCreating}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSelect(template.id);
                        }}
                        endDecorator={<ArrowRight size={16} />}
                      >
                        Use template
                      </JoyButton>
                    </JoyCardContent>
                  </JoyCard>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Stack>
      </JoyDialogContent>
      <JoyDialogActions>
        <JoyButton
          bloomVariant="ghost"
          color="neutral"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </JoyButton>
      </JoyDialogActions>
    </JoyDialog>
  );
}
