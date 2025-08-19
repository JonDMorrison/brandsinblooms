import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Phone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { SMSStats } from '@/hooks/useSMSStats';

interface SMSRecentMessagesProps {
  messages: SMSStats['recentMessages'];
}

export const SMSRecentMessages: React.FC<SMSRecentMessagesProps> = ({ messages }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="text-xs">Sent</Badge>;
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800 text-xs">Delivered</Badge>;
      case 'queued':
        return <Badge variant="outline" className="text-xs">Queued</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-xs">Failed</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const formatPhone = (phone: string) => {
    // Simple phone formatting - you might want to use a proper phone formatting library
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <Card id="messages">
      <CardHeader>
        <CardTitle>Recent Messages</CardTitle>
        <CardDescription>Latest SMS messages sent to customers</CardDescription>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No recent messages</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="flex items-start space-x-3 p-3 border rounded-lg"
                >
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium truncate">
                        {formatPhone(message.phone)}
                      </p>
                      {getStatusBadge(message.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {message.content}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};