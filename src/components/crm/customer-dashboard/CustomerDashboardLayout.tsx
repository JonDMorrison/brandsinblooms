import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Download, Edit, Mail, MessageSquare, FileText, StickyNote, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ActionMenu, ActionMenuItem } from '@/components/ui/action-menu';
import { useToast } from '@/hooks/use-toast';

type TimeRange = '7d' | '30d' | '90d' | 'lifetime';

interface CustomerDashboardLayoutProps {
  children: React.ReactNode;
  customerName?: string;
  customerId?: string;
  onTimeRangeChange?: (range: TimeRange) => void;
  selectedTimeRange?: TimeRange;
  className?: string;
  onEditCustomer?: () => void;
  onSendEmail?: () => void;
  onSendSMS?: () => void;
  onViewActivityLog?: () => void;
  onAddNote?: () => void;
  onDeleteCustomer?: () => void;
  onExportReport?: () => void;
}

export const CustomerDashboardLayout: React.FC<CustomerDashboardLayoutProps> = ({
  children,
  customerName,
  customerId,
  onTimeRangeChange,
  selectedTimeRange = '30d',
  className,
  onEditCustomer,
  onSendEmail,
  onSendSMS,
  onViewActivityLog,
  onAddNote,
  onDeleteCustomer,
  onExportReport,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState<TimeRange>(selectedTimeRange);

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    onTimeRangeChange?.(range);
  };

  const handleExport = () => {
    if (onExportReport) {
      onExportReport();
    } else {
      toast({
        title: 'Export Started',
        description: `Exporting report for ${customerName || 'customer'}...`,
      });
    }
  };

  const handleEdit = () => {
    if (onEditCustomer) {
      onEditCustomer();
    } else {
      toast({
        title: 'Edit Customer',
        description: 'Edit functionality coming soon.',
      });
    }
  };

  const handleSendEmail = () => {
    if (onSendEmail) {
      onSendEmail();
    } else {
      toast({
        title: 'Send Email',
        description: 'Email functionality coming soon.',
      });
    }
  };

  const handleSendSMS = () => {
    if (onSendSMS) {
      onSendSMS();
    } else {
      toast({
        title: 'Send SMS',
        description: 'SMS functionality coming soon.',
      });
    }
  };

  const handleViewActivityLog = () => {
    if (onViewActivityLog) {
      onViewActivityLog();
    } else {
      toast({
        title: 'Activity Log',
        description: 'Scrolling to activity section.',
      });
    }
  };

  const handleAddNote = () => {
    if (onAddNote) {
      onAddNote();
    } else {
      toast({
        title: 'Add Note',
        description: 'Note functionality coming soon.',
      });
    }
  };

  const handleDeleteCustomer = () => {
    if (onDeleteCustomer) {
      onDeleteCustomer();
    } else {
      toast({
        title: 'Customer Deleted',
        description: `${customerName || 'Customer'} has been deleted.`,
        variant: 'destructive',
      });
      navigate('/crm/customers');
    }
  };

  const menuItems: ActionMenuItem[] = [
    { label: 'Export Report', icon: Download, onClick: handleExport },
    { label: 'Edit Customer', icon: Edit, onClick: handleEdit },
    { label: 'Send Email', icon: Mail, onClick: handleSendEmail },
    { label: 'Send SMS', icon: MessageSquare, onClick: handleSendSMS },
    { label: 'View Activity Log', icon: FileText, onClick: handleViewActivityLog },
    { label: 'Add Note', icon: StickyNote, onClick: handleAddNote },
    { type: 'separator' } as any,
    {
      label: 'Delete Customer',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirmation: true,
      confirmationTitle: 'Delete Customer',
      confirmationDescription: `Are you sure you want to delete ${customerName || 'this customer'}? This action cannot be undone.`,
      confirmationActionLabel: 'Delete',
      onClick: handleDeleteCustomer,
    },
  ];

  return (
    <div className={cn('min-h-screen bg-background', className)}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Left: Back button and title */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/crm/customers')}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Customers</span>
              </Button>
              {customerName && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">/</span>
                  <h1 className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-none">
                    {customerName}
                  </h1>
                </div>
              )}
            </div>

            {/* Right: Time range selector and actions */}
            <div className="flex items-center gap-2">
              <Tabs
                value={timeRange}
                onValueChange={(v) => handleTimeRangeChange(v as TimeRange)}
                className="hidden sm:block"
              >
                <TabsList className="h-8">
                  <TabsTrigger value="7d" className="text-xs px-2.5">7d</TabsTrigger>
                  <TabsTrigger value="30d" className="text-xs px-2.5">30d</TabsTrigger>
                  <TabsTrigger value="90d" className="text-xs px-2.5">90d</TabsTrigger>
                  <TabsTrigger value="lifetime" className="text-xs px-2.5">All</TabsTrigger>
                </TabsList>
              </Tabs>

              <ActionMenu
                items={menuItems}
                trigger="horizontal"
                align="end"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default CustomerDashboardLayout;
