import Typography from "@mui/joy/Typography";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { segmentRuleToNaturalLanguage } from "@/lib/segmentRuleToNaturalLanguage";
import type { SegmentField, SegmentRuleGroup } from "@/lib/segmentFields";

export function NaturalLanguageRulePreview({
  group,
  fields,
}: {
  group: SegmentRuleGroup;
  fields: SegmentField[];
}) {
  const summary = segmentRuleToNaturalLanguage(group, fields);
  const isIncompleteSummary = summary.includes("an incomplete rule");

  return (
    <JoyCard>
      <JoyCardHeader
        description="A human-readable summary of the current audience logic."
        title="Audience summary"
      />
      <JoyCardContent sx={{ pt: 3 }}>
        <Typography
          level={isIncompleteSummary ? "body-sm" : "body-md"}
          sx={{
            color: isIncompleteSummary ? "neutral.500" : "neutral.800",
            fontStyle: isIncompleteSummary ? "italic" : "normal",
            lineHeight: 1.6,
          }}
        >
          {isIncompleteSummary
            ? "Complete the current rule to see a human-readable audience summary."
            : summary}
        </Typography>
      </JoyCardContent>
    </JoyCard>
  );
}
