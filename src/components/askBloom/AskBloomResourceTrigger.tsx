import Button from "@mui/joy/Button";
import { Sparkles } from "lucide-react";
import { useAskBloom } from "@/providers/AskBloomProvider";
import type { ResourceFocus } from "@/types/askBloom";

interface AskBloomResourceTriggerProps {
  resourceType: ResourceFocus["resourceType"];
  resourceId: string;
  resourceLabel: string;
  buildContext: () => ResourceFocus;
}

const truncateLabel = (value: string, maxLength = 20) => {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
};

export function AskBloomResourceTrigger({
  resourceType,
  resourceId,
  resourceLabel,
  buildContext,
}: AskBloomResourceTriggerProps) {
  const askBloom = useAskBloom();
  const isFocusedHere =
    askBloom.state.isOpen && askBloom.isResourceMatch(resourceType, resourceId);

  const buttonLabel = isFocusedHere
    ? "Bloom is focused here"
    : `Ask Bloom about ${truncateLabel(resourceLabel || "this record")}`;

  return (
    <Button
      variant={isFocusedHere ? "solid" : "soft"}
      color="primary"
      size="sm"
      startDecorator={<Sparkles size={16} />}
      onClick={() => {
        if (isFocusedHere) {
          askBloom.close();
          return;
        }

        askBloom.openWithResource(buildContext());
      }}
      sx={{
        borderRadius: "8px",
        fontWeight: 500,
        fontSize: "13px",
      }}
    >
      {buttonLabel}
    </Button>
  );
}
