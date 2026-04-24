import React from 'react';
import { Badge } from '@/components/ui-legacy/badge';
import { TicketStatus } from '@/types/helpdesk';

interface Props {
  status: TicketStatus;
}

const statusConfig = {
  open: { label: 'Open', className: 'bg-blue-500 text-white hover:bg-blue-600' },
  pending: { label: 'Pending', className: 'bg-yellow-500 text-white hover:bg-yellow-600' },
  in_progress: { label: 'In Progress', className: 'bg-purple-500 text-white hover:bg-purple-600' },
  resolved: { label: 'Resolved', className: 'bg-green-500 text-white hover:bg-green-600' },
  closed: { label: 'Closed', className: 'bg-gray-500 text-white hover:bg-gray-600' },
};

export const TicketStatusBadge: React.FC<Props> = ({ status }) => {
  const config = statusConfig[status];
  
  return (
    <Badge className={config.className}>
      {config.label}
    </Badge>
  );
};
