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

export function AskBloomResourceTrigger({
  resourceType,
  resourceId,
  buildContext,
}: AskBloomResourceTriggerProps) {
  const askBloom = useAskBloom();
  const isFocusedHere =
    askBloom.state.isOpen && askBloom.isResourceMatch(resourceType, resourceId);

  const buttonLabel = isFocusedHere ? "Bloom is focused here" : "Ask Bloom";

  return (
    <Button
      variant={isFocusedHere ? "solid" : "outlined"}
      color="neutral"
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
        backgroundColor: isFocusedHere ? "neutral.800" : "#fff",
        minHeight: 44,
        fontWeight: 500,
        fontSize: "13px",
      }}
    >
      {buttonLabel}
    </Button>
  );
}
