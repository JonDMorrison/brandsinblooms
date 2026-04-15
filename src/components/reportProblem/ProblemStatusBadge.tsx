import React from "react";
import { JoyStatusChip } from "@/components/joy/JoyChip";
import { ProblemStatus } from "@/types/reportedProblems";

interface Props {
  status: ProblemStatus;
}

export const ProblemStatusBadge: React.FC<Props> = ({ status }) => {
  return <JoyStatusChip status={status} />;
};
