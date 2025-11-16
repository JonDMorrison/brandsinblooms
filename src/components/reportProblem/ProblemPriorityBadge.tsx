import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ProblemPriority } from '@/types/reportedProblems';

interface Props {
  priority: ProblemPriority;
}

const priorityConfig = {
  low: { label: 'Low', className: 'bg-gray-400 text-white' },
  medium: { label: 'Medium', className: 'bg-blue-500 text-white' },
  high: { label: 'High', className: 'bg-orange-500 text-white' },
  urgent: { label: 'Urgent', className: 'bg-red-500 text-white' },
};

export const ProblemPriorityBadge: React.FC<Props> = ({ priority }) => {
  const config = priorityConfig[priority];
  
  return (
    <Badge className={config.className}>
      {config.label}
    </Badge>
  );
};
