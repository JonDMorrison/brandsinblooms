import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Mail, MessageSquare, Gift, MousePointer, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CustomerActivityProps {
  customerId: string;
}

interface TimelineEvent {
  id: string;
  event_type: string;
  event_date: string;
  title: string;
  description: string | null;
  metadata: any;
  amount: number | null;
}

export const CustomerActivity = ({ customerId }: CustomerActivityProps) => {
  // Fetch customer timeline events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['customer-timeline-events', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_timeline_events')
        .select('*')
        .eq('customer_id', customerId)
        .order('event_date', { ascending: false });

      if (error) throw error;
      return data as TimelineEvent[];
    },
  });

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'email_sent':
        return <Mail className="h-4 w-4" />;
      case 'sms_sent':
        return <MessageSquare className="h-4 w-4" />;
      case 'coupon_redeemed':
        return <Gift className="h-4 w-4" />;
      case 'campaign_interaction':
        return <MousePointer className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'email_sent':
        return 'bg-blue-500 text-white';
      case 'sms_sent':
        return 'bg-green-500 text-white';
      case 'coupon_redeemed':
        return 'bg-purple-500 text-white';
      case 'campaign_interaction':
        return 'bg-orange-500 text-white';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getEventTitle = (eventType: string) => {
    switch (eventType) {
      case 'email_sent':
        return 'Email Sent';
      case 'sms_sent':
        return 'SMS Sent';
      case 'coupon_redeemed':
        return 'Coupon Redeemed';
      case 'campaign_interaction':
        return 'Campaign Interaction';
      default:
        return 'Activity';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Messages & Automations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Messages & Automations ({events.length})
        </CardTitle>
      </CardHeader>

      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No activity found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Messages, automations, and campaign interactions will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event, index) => (
              <div key={event.id}>
                <div className="flex items-start gap-4">
                  <div className={`rounded-full p-2 ${getEventColor(event.event_type)}`}>
                    {getEventIcon(event.event_type)}
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{event.title}</h4>
                        <Badge variant="outline">
                          {getEventTitle(event.event_type)}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(event.event_date), { addSuffix: true })}
                      </span>
                    </div>

                    {event.description && (
                      <p className="text-sm text-muted-foreground">
                        {event.description}
                      </p>
                    )}

                    {event.amount && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Value:</span>
                        <Badge variant="secondary">
                          ${event.amount.toFixed(2)}
                        </Badge>
                      </div>
                    )}

                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                        <details>
                          <summary className="cursor-pointer">View Details</summary>
                          <pre className="mt-2 text-xs">
                            {JSON.stringify(event.metadata, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
                
                {index < events.length - 1 && (
                  <Separator className="my-4" />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};