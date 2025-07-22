import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Mail, Calendar, Clock, Users, Eye } from 'lucide-react';

interface Newsletter {
  id: string;
  name: string;
  subject_line: string;
  status: 'draft' | 'scheduled' | 'sent';
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  segment_id?: string;
  crm_segments?: {
    name: string;
  };
  metrics?: {
    sent?: number;
    opened?: number;
    clicked?: number;
  };
}

interface NewsletterCalendarBlockProps {
  newsletter: Newsletter;
  onClick: (newsletter: Newsletter) => void;
  isCompact?: boolean;
}

export const NewsletterCalendarBlock: React.FC<NewsletterCalendarBlockProps> = ({ 
  newsletter, 
  onClick,
  isCompact = false 
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-green-100 border-green-500 text-green-800';
      case 'draft':
        return 'bg-gray-100 border-gray-400 text-gray-700';
      case 'sent':
        return 'bg-blue-100 border-blue-500 text-blue-800';
      default:
        return 'bg-gray-100 border-gray-400 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Clock className="w-3 h-3" />;
      case 'draft':
        return <Mail className="w-3 h-3" />;
      case 'sent':
        return <Eye className="w-3 h-3" />;
      default:
        return <Mail className="w-3 h-3" />;
    }
  };

  const scheduleTime = newsletter.scheduled_at ? new Date(newsletter.scheduled_at) : null;
  const sentTime = newsletter.sent_at ? new Date(newsletter.sent_at) : null;

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md border-l-4",
        getStatusColor(newsletter.status),
        isCompact ? "p-2" : "p-3"
      )}
      onClick={() => onClick(newsletter)}
    >
      <CardContent className={cn("p-0", isCompact ? "space-y-1" : "space-y-2")}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {getStatusIcon(newsletter.status)}
              <h3 className={cn(
                "font-medium truncate",
                isCompact ? "text-xs" : "text-sm"
              )}>
                {newsletter.subject_line || newsletter.name}
              </h3>
            </div>
            {!isCompact && (
              <p className="text-xs text-muted-foreground truncate">
                {newsletter.name}
              </p>
            )}
          </div>
          <Badge 
            variant="outline" 
            className={cn(
              "ml-2 capitalize",
              isCompact ? "text-xs px-1" : "text-xs"
            )}
          >
            {newsletter.status}
          </Badge>
        </div>

        {!isCompact && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              {newsletter.crm_segments?.name && (
                <>
                  <Users className="w-3 h-3" />
                  <span className="truncate">{newsletter.crm_segments.name}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>
                {scheduleTime ? format(scheduleTime, 'h:mm a') : 
                 sentTime ? format(sentTime, 'h:mm a') : 
                 'No time set'}
              </span>
            </div>
          </div>
        )}

        {isCompact && scheduleTime && (
          <div className="text-xs text-muted-foreground">
            {format(scheduleTime, 'h:mm a')}
          </div>
        )}

        {newsletter.status === 'sent' && newsletter.metrics && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
            <span>Sent: {newsletter.metrics.sent || 0}</span>
            <span>Opens: {newsletter.metrics.opened || 0}</span>
            <span>Clicks: {newsletter.metrics.clicked || 0}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};