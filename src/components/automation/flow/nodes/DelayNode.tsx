import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AutomationNodeShell } from "@/components/automation/flow/nodes/AutomationNodeShell";
import type {
  AutomationNodeEditorHandler,
  DelayNodeData,
} from "@/components/automation/flow/automationBuilderTypes";
import { getAutomationNodeVisual } from "@/components/automation/flow/automationNodeVisuals";

type DelayNodeProps = NodeProps<DelayNodeData> & {
  onEdit?: AutomationNodeEditorHandler;
  onDelete?: (nodeId: string) => void;
};

const DelayNode: React.FC<DelayNodeProps> = ({
  id,
  data,
  selected,
  onEdit,
  onDelete,
}) => {
  const visual = getAutomationNodeVisual("delay", data);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(id, "delay", data);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(id);
  };

  const handleCardClick = () => {
    onEdit?.(id, "delay", data);
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
      <Handle
        type="source"
        position={Position.Bottom}
        className="automation-node-handle"
        style={{
          bottom: -7,
        }}
      />
    </AutomationNodeShell>
  );
};

export default memo(DelayNode);
