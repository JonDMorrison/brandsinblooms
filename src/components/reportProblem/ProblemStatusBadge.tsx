import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ProblemStatus } from '@/types/reportedProblems';

interface Props {
  status: ProblemStatus;
}

const statusConfig = {
  open: { label: 'Open', className: 'bg-blue-500 text-white hover:bg-blue-600' },
  investigating: { label: 'Investigating', className: 'bg-yellow-500 text-white hover:bg-yellow-600' },
  resolved: { label: 'Resolved', className: 'bg-green-500 text-white hover:bg-green-600' },
  closed: { label: 'Closed', className: 'bg-gray-500 text-white hover:bg-gray-600' },
};

export const ProblemStatusBadge: React.FC<Props> = ({ status }) => {
  const config = statusConfig[status];
  
  return (
    <Badge className={config.className}>
      {config.label}
    </Badge>
  );
};
