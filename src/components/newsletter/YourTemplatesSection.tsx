import * as React from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { IntentCardThumbnail } from "@/components/crm/campaign-editor/IntentCardThumbnail";
import { useSavedTemplates, type SavedTemplate } from "@/hooks/useSavedTemplates";

/**
 * "Your templates" on Create a Newsletter: saved designs for this business.
 * Choosing one starts a new draft from it.
 */
export function YourTemplatesSection({
  busy = false,
  onUseTemplate,
}: {
  busy?: boolean;
  onUseTemplate: (template: SavedTemplate) => void;
}) {
  const { savedTemplates, isLoading } = useSavedTemplates();

  return (
    <Stack spacing={1.5} data-testid="your-templates">
      <Stack spacing={0.5}>
        <Typography
          level="title-lg"
          sx={{ fontWeight: 700, color: "var(--hp-green-900, #11302E)" }}
        >
          Your templates
        </Typography>
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          Designs you saved from Design Studio.
        </Typography>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} variant="rectangular" sx={{ height: 180, borderRadius: "lg" }} />
          ))}
        </Box>
      ) : savedTemplates.length === 0 ? (
        <Sheet
          variant="soft"
          data-testid="your-templates-empty"
          sx={{ borderRadius: "lg", p: 2.5 }}
        >
          <Typography level="title-sm">No saved templates yet</Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary", mt: 0.5 }}>
            In Design Studio, use “Save template” to reuse a design for future emails.
          </Typography>
        </Sheet>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
            gap: 2,
          }}
        >
          {savedTemplates.map((template) => {
            const blockCount = template.layout_json.filter(
              (block) => block.type !== "footer",
            ).length;
            return (
              <Box
                key={template.id}
                component="button"
                type="button"
                disabled={busy}
                onClick={() => onUseTemplate(template)}
                aria-label={`Use template ${template.name}`}
                data-testid={`your-template-${template.id}`}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  p: 1.5,
                  textAlign: "left",
                  font: "inherit",
                  cursor: busy ? "progress" : "pointer",
                  bgcolor: "background.surface",
                  border: "1px solid",
                  borderColor: "neutral.200",
                  borderRadius: "lg",
                  "&:hover": { borderColor: "neutral.400" },
                  "&:focus-visible": { outline: "2px solid #244d46", outlineOffset: 2 },
                }}
              >
                <IntentCardThumbnail template={null} blocks={template.layout_json} />
                <Typography level="title-sm" noWrap>
                  {template.name}
                </Typography>
                <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                  {blockCount} block{blockCount === 1 ? "" : "s"}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Stack>
  );
}
