import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { useTickets } from '@/hooks/helpdesk/useTickets';
import { TicketStatusBadge } from '@/components/helpdesk/TicketStatusBadge';
import { TicketPriorityBadge } from '@/components/helpdesk/TicketPriorityBadge';
import { format } from 'date-fns';

const TicketListPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  
  const { data: ticketsData, isLoading } = useTickets({ search });
  const tickets = ticketsData?.tickets || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Tickets</h1>
          <p className="text-muted-foreground mt-1">
            View and manage your support tickets
          </p>
        </div>
        <Button onClick={() => navigate('/helpdesk/tickets/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Ticket
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading tickets...</p>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No tickets found</p>
              <Button onClick={() => navigate('/helpdesk/tickets/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Ticket
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={() => navigate(`/helpdesk/tickets/${ticket.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-sm text-muted-foreground">
                        {ticket.ticket_number}
                      </span>
                      <TicketStatusBadge status={ticket.status} />
                      <TicketPriorityBadge priority={ticket.priority} />
                    </div>
                    <h3 className="font-semibold truncate">{ticket.subject}</h3>
                    <p className="text-sm text-muted-foreground">
                      Created {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TicketListPage;
