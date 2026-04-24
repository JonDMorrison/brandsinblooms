import React from "react";
import { JoyStatusChip } from "@/components/joy/JoyChip";
import { ProblemPriority } from "@/types/reportedProblems";

interface Props {
  priority: ProblemPriority;
}

export const ProblemPriorityBadge: React.FC<Props> = ({ priority }) => {
  return <JoyStatusChip status={priority} />;
};
