import * as React from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { Edge, Node } from "@xyflow/react";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { validateFlow } from "@/components/automation/flow/flowValidationUtils";

interface FlowValidationProps {
  nodes: Node[];
  edges: Edge[];
  selectedSegments?: Array<{ id: string }>;
  selectedPersonas?: Array<{ id: string }>;
  onOpenAudience?: () => void;
  onSelectNode?: (nodeId: string) => void;
}

export const ValidationPanel: React.FC<FlowValidationProps> = ({
  nodes,
  edges,
  selectedSegments = [],
  selectedPersonas = [],
  onOpenAudience,
  onSelectNode,
}) => {
  const validation = validateFlow(
    nodes,
    edges,
    selectedSegments,
    selectedPersonas,
  );
  const triggerNode = nodes.find((node) => node.type === "trigger");

  return (
    <Sheet
      variant="outlined"
      sx={{
        width: 320,
        p: 1.5,
        borderRadius: "lg",
        boxShadow: "lg",
        backgroundColor: "background.surface",
      }}
    >
      <Stack spacing={1.25}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography level="title-sm">Launch checklist</Typography>
          <Typography
            level="body-xs"
            sx={{
              color: validation.errors.length ? "danger.600" : "success.600",
            }}
          >
            {validation.errors.length
              ? `${validation.errors.length} issues`
              : "Ready"}
          </Typography>
        </Stack>

        {validation.errors.length === 0 ? (
          <Alert
            color="success"
            variant="soft"
            startDecorator={<CheckCircle2 size={16} />}
          >
            Core launch requirements are satisfied.
          </Alert>
        ) : (
          <Alert
            color="danger"
            variant="soft"
            startDecorator={<AlertCircle size={16} />}
          >
            Fix launch blockers before activating this automation.
          </Alert>
        )}

        {validation.errors.length > 0 ? (
          <Stack spacing={0.75}>
            {validation.errors.map((error) => (
              <Typography key={error} level="body-sm">
                {error}
              </Typography>
            ))}
          </Stack>
        ) : null}

        {validation.warnings.length > 0 ? (
          <Box>
            <Typography
              level="body-xs"
              fontWeight="lg"
              sx={{ color: "neutral.500", mb: 0.5 }}
            >
              Warnings
            </Typography>
            <Stack spacing={0.5}>
              {validation.warnings.slice(0, 3).map((warning) => (
                <Typography
                  key={warning}
                  level="body-xs"
                  sx={{ color: "neutral.500" }}
                >
                  {warning}
                </Typography>
              ))}
            </Stack>
          </Box>
        ) : null}

        {triggerNode &&
        (triggerNode.data as { triggerType?: string } | undefined)
          ?.triggerType === "segment.added" &&
        selectedSegments.length === 0 ? (
          <Button
            variant="soft"
            color="neutral"
            endDecorator={<ArrowRight size={14} />}
            onClick={onOpenAudience}
          >
            Select segment
          </Button>
        ) : null}

        {triggerNode &&
        (triggerNode.data as { triggerType?: string } | undefined)
          ?.triggerType === "persona.assigned" &&
        selectedPersonas.length === 0 ? (
          <Button
            variant="soft"
            color="neutral"
            endDecorator={<ArrowRight size={14} />}
            onClick={onOpenAudience}
          >
            Select persona
          </Button>
        ) : null}

        {!triggerNode ? (
          <Button
            variant="soft"
            color="neutral"
            endDecorator={<ArrowRight size={14} />}
            onClick={() => {
              const firstNode = nodes[0];
              if (firstNode) {
                onSelectNode?.(firstNode.id);
              }
            }}
          >
            Focus canvas
          </Button>
        ) : null}
      </Stack>
    </Sheet>
  );
};
