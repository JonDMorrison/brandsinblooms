import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { 
  Mail, 
  Calendar, 
  Clock, 
  Users, 
  Eye, 
  Edit, 
  Copy, 
  Trash2, 
  ExternalLink,
  BarChart3,
  Send
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Newsletter {
  id: string;
  name: string;
  subject_line: string;
  preheader_text?: string;
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
    revenue?: number;
  };
}

interface NewsletterEditDrawerProps {
  newsletter: Newsletter | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (newsletter: Newsletter) => void;
  onDuplicate: (newsletter: Newsletter) => void;
  onDelete: (newsletter: Newsletter) => void;
  onViewInCRM: (newsletter: Newsletter) => void;
}

export const NewsletterEditDrawer: React.FC<NewsletterEditDrawerProps> = ({
  newsletter,
  isOpen,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  onViewInCRM
}) => {
  const { toast } = useToast();

  if (!newsletter) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'draft':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'sent':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const scheduleTime = newsletter.scheduled_at ? new Date(newsletter.scheduled_at) : null;
  const sentTime = newsletter.sent_at ? new Date(newsletter.sent_at) : null;
  const isEditable = newsletter.status !== 'sent';

  const handleEdit = () => {
    onEdit(newsletter);
    onClose();
  };

  const handleDuplicate = () => {
    onDuplicate(newsletter);
    onClose();
    toast({
      title: "Newsletter Duplicated",
      description: "A copy of this newsletter has been created."
    });
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this newsletter?')) {
      onDelete(newsletter);
      onClose();
    }
  };

  const handleViewInCRM = () => {
    onViewInCRM(newsletter);
  };

  const openRate = newsletter.metrics?.sent && newsletter.metrics?.opened 
    ? ((newsletter.metrics.opened / newsletter.metrics.sent) * 100).toFixed(1)
    : '0';

  const clickRate = newsletter.metrics?.sent && newsletter.metrics?.clicked 
    ? ((newsletter.metrics.clicked / newsletter.metrics.sent) * 100).toFixed(1)
    : '0';

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <SheetTitle className="text-left">{newsletter.name}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                {newsletter.subject_line}
              </p>
            </div>
            <Badge className={cn("capitalize", getStatusColor(newsletter.status))}>
              {newsletter.status}
            </Badge>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Newsletter Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Subject:</span>
              <span>{newsletter.subject_line}</span>
            </div>

            {newsletter.preheader_text && (
              <div className="flex items-start gap-2 text-sm">
                <Eye className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span className="font-medium">Preheader:</span>
                <span className="text-muted-foreground">{newsletter.preheader_text}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Audience:</span>
              <span>{newsletter.crm_segments?.name || 'All Customers'}</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Created:</span>
              <span>{format(new Date(newsletter.created_at), 'MMM d, yyyy')}</span>
            </div>

            {scheduleTime && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Scheduled:</span>
                <span>{format(scheduleTime, 'MMM d, yyyy h:mm a')}</span>
              </div>
            )}

            {sentTime && (
              <div className="flex items-center gap-2 text-sm">
                <Send className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Sent:</span>
                <span>{format(sentTime, 'MMM d, yyyy h:mm a')}</span>
              </div>
            )}
          </div>

          {/* Performance Metrics - Only show if sent */}
          {newsletter.status === 'sent' && newsletter.metrics && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h3 className="font-medium">Performance Metrics</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Total Sent</p>
                    <p className="text-lg font-semibold">{newsletter.metrics.sent || 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Opens</p>
                    <p className="text-lg font-semibold">{newsletter.metrics.opened || 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Open Rate</p>
                    <p className="text-lg font-semibold">{openRate}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Click Rate</p>
                    <p className="text-lg font-semibold">{clickRate}%</p>
                  </div>
                </div>

                {newsletter.metrics.revenue && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Revenue Generated</p>
                    <p className="text-lg font-semibold text-green-600">
                      ${newsletter.metrics.revenue.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Preview Content Block */}
          <div className="space-y-2">
            <h3 className="font-medium">Content Preview</h3>
            <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
              <p>Newsletter content will be available when you edit this campaign in the CRM.</p>
            </div>
          </div>

          {/* Action Buttons */}
          <Separator />
          <div className="space-y-3">
            {isEditable && (
              <Button onClick={handleEdit} className="w-full">
                <Edit className="w-4 h-4 mr-2" />
                Edit Newsletter
              </Button>
            )}

            <Button onClick={handleViewInCRM} variant="outline" className="w-full">
              <ExternalLink className="w-4 h-4 mr-2" />
              View in CRM
            </Button>

            <Button onClick={handleDuplicate} variant="outline" className="w-full">
              <Copy className="w-4 h-4 mr-2" />
              Duplicate Newsletter
            </Button>

            {isEditable && (
              <Button onClick={handleDelete} variant="destructive" className="w-full">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Newsletter
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};