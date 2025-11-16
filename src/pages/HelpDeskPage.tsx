import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Ticket, Plus, List, BarChart3 } from 'lucide-react';
import { useTickets } from '@/hooks/helpdesk/useTickets';
import { useAuth } from '@/contexts/AuthContext';
import { TicketStatusBadge } from '@/components/helpdesk/TicketStatusBadge';
import { TicketPriorityBadge } from '@/components/helpdesk/TicketPriorityBadge';

const HelpDeskPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'support_agent';

  const { data: ticketsData, isLoading } = useTickets({ pageSize: 5 });
  const tickets = ticketsData?.tickets || [];

  const openTicketsCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Help Desk</h1>
          <p className="text-muted-foreground mt-1">
            Manage support tickets and customer inquiries
          </p>
        </div>
        <Button onClick={() => navigate('/helpdesk/tickets/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Ticket
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : openTicketsCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : inProgressCount}</div>
            <p className="text-xs text-muted-foreground">Being worked on</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : ticketsData?.totalCount || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Get started with common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/helpdesk/tickets/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Ticket
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/helpdesk/tickets')}>
              <List className="h-4 w-4 mr-2" />
              View All Tickets
            </Button>
            {isAdmin && (
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/helpdesk/admin/analytics')}>
                <BarChart3 className="h-4 w-4 mr-2" />
                View Analytics
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Tickets</CardTitle>
            <CardDescription>Your latest support requests</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tickets yet</p>
            ) : (
              <div className="space-y-3">
                {tickets.slice(0, 5).map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => navigate(`/helpdesk/tickets/${ticket.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{ticket.subject}</p>
                      <p className="text-sm text-muted-foreground">{ticket.ticket_number}</p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <TicketStatusBadge status={ticket.status} />
                      <TicketPriorityBadge priority={ticket.priority} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HelpDeskPage;
