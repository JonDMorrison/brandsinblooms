import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  syncNewsletterToCRM, 
  validateNewsletterForSync, 
  checkSyncStatus 
} from '@/utils/newsletterSyncToCRM';
import { 
  Send, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  Loader2,
  ArrowRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NewsletterSyncButtonProps {
  contentTaskId: string;
  themeCampaignId: string;
  newsletterContent: string;
  campaignTitle?: string;
}

export const NewsletterSyncButton: React.FC<NewsletterSyncButtonProps> = ({
  contentTaskId,
  themeCampaignId,
  newsletterContent,
  campaignTitle
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [syncStatus, setSyncStatus] = useState<{
    isSynced: boolean;
    campaignId?: string;
  }>({ isSynced: false });
  
  const [validation, setValidation] = useState<{
    isValid: boolean;
    errors: string[];
  }>({ isValid: false, errors: [] });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check sync status and validate content on mount
  useEffect(() => {
    const checkStatusAndValidate = async () => {
      if (!user?.id || !newsletterContent) return;

      setIsLoading(true);
      
      try {
        // Check if already synced
        const status = await checkSyncStatus(themeCampaignId, user.id);
        setSyncStatus(status);

        // Validate newsletter content
        const validationResult = validateNewsletterForSync(newsletterContent);
        setValidation(validationResult);
      } catch (error) {
        console.error('Failed to check sync status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkStatusAndValidate();
  }, [user?.id, themeCampaignId, newsletterContent]);

  const handleSync = async () => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please log in to sync newsletter to CRM",
        variant: "destructive"
      });
      return;
    }

    setIsSyncing(true);
    
    try {
      const result = await syncNewsletterToCRM(
        contentTaskId,
        themeCampaignId,
        user.id
      );

      if (result.success && result.campaignId) {
        setSyncStatus({ isSynced: true, campaignId: result.campaignId });
        
        toast({
          title: "✅ Newsletter Synced to CRM!",
          description: `Campaign "${campaignTitle}" is now available in CRM`,
          variant: "default"
        });
      } else {
        const errorMessage = result.errors?.join(', ') || 'Failed to sync newsletter';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Sync failed:', error);
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync newsletter to CRM",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleViewInCRM = () => {
    if (syncStatus.campaignId) {
      navigate(`/crm/campaigns/${syncStatus.campaignId}`);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-4 border-gray-200">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm text-gray-600">Checking sync status...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">CRM Sync</h3>
          </div>
          
          {syncStatus.isSynced ? (
            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
              <CheckCircle className="w-3 h-3 mr-1" />
              Synced
            </Badge>
          ) : validation.isValid ? (
            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
              Ready to Sync
            </Badge>
          ) : (
            <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
              <AlertCircle className="w-3 h-3 mr-1" />
              Issues Found
            </Badge>
          )}
        </div>

        {/* Content */}
        {syncStatus.isSynced ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-700">
              This newsletter has been synced to CRM and is ready for editing and sending.
            </p>
            <Button 
              onClick={handleViewInCRM}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View in CRM
            </Button>
          </div>
        ) : validation.isValid ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-700">
              Newsletter is ready to sync to CRM for editing and sending.
            </p>
            <Button 
              onClick={handleSync}
              disabled={isSyncing}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing to CRM...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Sync to CRM
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-red-700 font-medium">
              Newsletter validation failed:
            </p>
            <ul className="text-xs text-red-600 space-y-1">
              {validation.errors.slice(0, 3).map((error, index) => (
                <li key={index} className="flex items-start gap-1">
                  <span className="text-red-500 mt-0.5">•</span>
                  {error}
                </li>
              ))}
              {validation.errors.length > 3 && (
                <li className="text-red-500 font-medium">
                  ...and {validation.errors.length - 3} more issues
                </li>
              )}
            </ul>
            <p className="text-xs text-gray-600 mt-2">
              Please regenerate the newsletter content to fix these issues.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};