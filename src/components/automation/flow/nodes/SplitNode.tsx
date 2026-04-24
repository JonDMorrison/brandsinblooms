import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import { AutomationNodeShell } from "@/components/automation/flow/nodes/AutomationNodeShell";
import type {
  AutomationNodeEditorHandler,
  SplitNodeData,
} from "@/components/automation/flow/automationBuilderTypes";
import { getAutomationNodeVisual } from "@/components/automation/flow/automationNodeVisuals";

type SplitNodeProps = NodeProps<SplitNodeData> & {
  onEdit?: AutomationNodeEditorHandler;
  onDelete?: (nodeId: string) => void;
};

const SplitNode: React.FC<SplitNodeProps> = ({
  data,
  selected,
  id,
  onEdit,
  onDelete,
}) => {
  const visual = getAutomationNodeVisual("split", data);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(id, "split", data);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(id);
  };

  const handleCardClick = () => {
    onEdit?.(id, "split", data);
  };

  return (
    <AutomationNodeShell
      title={visual.title}
      description={visual.description}
      summary={visual.summary}
      badge={visual.badge}
      color={visual.tone.color}
      borderColor={visual.tone.borderColor}
      hoverBorderColor={visual.tone.hoverBorderColor}
      backgroundColor={visual.tone.backgroundColor}
      accentColor={visual.tone.accentColor}
      ringColor={visual.tone.ringColor}
      selected={selected}
      icon={visual.icon}
      onClick={handleCardClick}
      onEdit={handleEdit}
      onDelete={handleDelete}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="automation-node-handle"
        style={{
          top: -7,
        }}
      />
      <Box sx={{ position: "relative", height: 18 }}>
        <Typography
          level="body-xs"
          sx={{ position: "absolute", left: "24%", color: "neutral.500" }}
        >
          Yes
        </Typography>
        <Typography
          level="body-xs"
          sx={{ position: "absolute", right: "24%", color: "neutral.500" }}
        >
          No
        </Typography>
      </Box>
      <Handle
        type="source"
        position={Position.Bottom}
        id="branch-a"
        className="automation-node-handle"
        style={{
          left: "30%",
          bottom: -7,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="branch-b"
        className="automation-node-handle"
        style={{
          left: "70%",
          bottom: -7,
        }}
      />
    </AutomationNodeShell>
  );
};

export default memo(SplitNode);
