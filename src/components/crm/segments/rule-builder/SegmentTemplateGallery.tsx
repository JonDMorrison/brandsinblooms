import SimpleGrid from "@mui/joy/Grid";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { segmentRuleToNaturalLanguage } from "@/lib/segmentRuleToNaturalLanguage";
import type { SegmentField, SegmentTemplate } from "@/lib/segmentFields";

export interface SegmentTemplateGalleryProps {
  templates: SegmentTemplate[];
  fields: SegmentField[];
  onApplyTemplate: (template: SegmentTemplate) => void;
}

export function SegmentTemplateGallery({
  templates,
  fields,
  onApplyTemplate,
}: SegmentTemplateGalleryProps) {
  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography level="title-md">Start from a proven template</Typography>
        <Typography level="body-sm" color="neutral">
          Templates seed the builder with common retention, revenue, and
          engagement patterns.
        </Typography>
      </Stack>

      <SimpleGrid container spacing={2}>
        {templates.map((template) => (
          <SimpleGrid key={template.id} xs={12} md={6} xl={4}>
            <JoyCard sx={{ height: "100%" }}>
              <JoyCardHeader
                description={template.description}
                title={template.name}
              />
              <JoyCardContent
                sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 3 }}
              >
                <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                  {segmentRuleToNaturalLanguage(template.group, fields)}
                </Typography>
                <JoyButton
                  bloomVariant="outline"
                  onClick={() => onApplyTemplate(template)}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Use template
                </JoyButton>
              </JoyCardContent>
            </JoyCard>
          </SimpleGrid>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
