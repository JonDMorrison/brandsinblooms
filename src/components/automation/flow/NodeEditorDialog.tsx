import React from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { X } from "lucide-react";
import { EmailNodeEditor } from "./editors/EmailNodeEditor";
import { SMSNodeEditor } from "./editors/SMSNodeEditor";
import { DelayNodeEditor } from "./editors/DelayNodeEditor";
import { TriggerNodeEditor } from "./editors/TriggerNodeEditor";
import { SplitNodeEditor } from "./editors/SplitNodeEditor";
import { JoyButton } from "@/components/joy/JoyButton";

interface NodeEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeType: string | null;
  nodeData: any;
  nodeId?: string;
  automationId?: string;
  onSave: (data: any) => void;
}

export const NodeEditorDialog: React.FC<NodeEditorDialogProps> = ({
  open,
  onOpenChange,
  nodeType,
  nodeData,
  nodeId,
  automationId,
  onSave,
}) => {
  if (!open || !nodeType || !nodeData) {
    return null;
  }

  const handleSave = (data: any) => {
    onSave(data);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const renderEditor = () => {
    switch (nodeType) {
      case "email":
        return (
          <EmailNodeEditor
            data={nodeData}
            nodeId={nodeId}
            automationId={automationId}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        );
      case "sms":
        return (
          <SMSNodeEditor
            data={nodeData}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        );
      case "delay":
        return (
          <DelayNodeEditor
            data={nodeData}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        );
      case "trigger":
        return (
          <TriggerNodeEditor
            data={nodeData}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        );
      case "split":
        return (
          <SplitNodeEditor
            data={nodeData}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Sheet
      variant="outlined"
      sx={{
        width: { xs: 320, xl: 380 },
        borderRadius: 0,
        borderTop: "none",
        borderBottom: "none",
        borderRight: "none",
        backgroundColor: "background.surface",
        display: { xs: "none", lg: "flex" },
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="flex-start"
        justifyContent="space-between"
        sx={{
          px: 2,
          py: 1.75,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box>
          <Typography
            level="body-xs"
            sx={{
              color: "neutral.500",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Properties
          </Typography>
          <Typography level="title-md" sx={{ mt: 0.5 }}>
            {formatNodeType(nodeType)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip variant="soft" color="neutral" size="sm">
            {nodeId?.slice(0, 8) ?? "node"}
          </Chip>
          <JoyButton
            size="icon"
            variant="plain"
            color="neutral"
            onClick={() => onOpenChange(false)}
          >
            <X size={16} />
          </JoyButton>
        </Stack>
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {renderEditor()}
      </Box>
    </Sheet>
  );
};

function formatNodeType(nodeType: string) {
  if (nodeType === "split") {
    return "Condition";
  }

  return nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
}
