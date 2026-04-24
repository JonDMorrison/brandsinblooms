import React, { useEffect, useMemo, useState } from "react";
import Badge from "@mui/joy/Badge";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import { Lightbulb } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyDrawer } from "@/components/joy/JoyDrawer";
import { AIGuidancePanel } from "./AIGuidancePanel";
import { triggerRequiresAudience } from "@/lib/automation/triggerCatalog";
import type { Node } from "@xyflow/react";

interface AIAssistantProps {
  nodes: Node[];
  hasAudience: boolean;
  isReadyToLaunch?: boolean;
  onAddNode?: (type: string) => void;
  onOpenAudienceSelector?: () => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  nodes,
  hasAudience,
  isReadyToLaunch = false,
  onAddNode,
  onOpenAudienceSelector,
}) => {
  const [open, setOpen] = useState(false);

  const hasTrigger = useMemo(
    () => nodes?.some((n: any) => n.type === "trigger"),
    [nodes],
  );
  const hasActions = useMemo(
    () => nodes?.some((n: any) => ["email", "sms", "delay"].includes(n.type)),
    [nodes],
  );

  // Get current trigger type to determine if audience is required
  const triggerNode = nodes?.find((n: any) => n.type === "trigger");
  const currentTriggerType = (triggerNode?.data?.triggerType as string) || "";
  const audienceRequired =
    !currentTriggerType || triggerRequiresAudience(currentTriggerType);

  // Calculate completion based on whether audience is required
  const totalSteps = audienceRequired ? 3 : 2;
  const audienceComplete = !audienceRequired || hasAudience;
  const completed =
    (hasTrigger ? 1 : 0) +
    (hasActions ? 1 : 0) +
    (audienceComplete && audienceRequired ? 1 : 0);

  useEffect(() => {
    const saved = localStorage.getItem("ai_assistant_open");
    if (saved === "true") setOpen(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("ai_assistant_open", open ? "true" : "false");
  }, [open]);

  return (
    <>
      <Box sx={{ position: "absolute", right: 16, bottom: 16, zIndex: 6 }}>
        <Badge badgeContent={`${completed}/${totalSteps}`} color="primary">
          <JoyButton
            aria-label="Open AI Assistant"
            variant="solid"
            color="primary"
            onClick={() => setOpen(true)}
            startDecorator={<Lightbulb size={16} />}
          >
            AI Assistant
          </JoyButton>
        </Badge>
      </Box>

      <JoyDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="AI Assistant"
        description="Guided steps to build your automation."
        anchor="right"
        size="md"
      >
        <Stack spacing={2}>
          <AIGuidancePanel
            nodes={nodes as any}
            hasValidFlow={Boolean(nodes?.length)}
            hasAudience={hasAudience}
            isReadyToLaunch={isReadyToLaunch}
            onAddNode={onAddNode || (() => {})}
            onOpenAudienceSelector={onOpenAudienceSelector || (() => {})}
          />

          <JoyButton
            variant="outlined"
            color="neutral"
            onClick={() => setOpen(false)}
          >
            Close
          </JoyButton>
        </Stack>
      </JoyDrawer>
    </>
  );
};
