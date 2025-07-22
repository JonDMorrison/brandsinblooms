import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NewsletterSyncStatusProps {
  isSynced: boolean;
  isValid: boolean;
  errorCount?: number;
  campaignId?: string;
  onViewInCRM?: () => void;
}

export const NewsletterSyncStatus: React.FC<NewsletterSyncStatusProps> = ({
  isSynced,
  isValid,
  errorCount = 0,
  campaignId,
  onViewInCRM
}) => {
  if (isSynced) {
    return (
      <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
        <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Synced to CRM
        </Badge>
        {onViewInCRM && (
          <Button
            onClick={onViewInCRM}
            variant="outline"
            size="sm"
            className="ml-auto h-6 px-2 text-xs"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            View
          </Button>
        )}
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
        <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          {errorCount} Issues
        </Badge>
        <span className="text-xs text-red-700">Sync blocked</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
        <Clock className="w-3 h-3 mr-1" />
        Ready to Sync
      </Badge>
    </div>
  );
};