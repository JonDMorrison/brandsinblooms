import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SenderConfigurationBannerProps {
  show: boolean;
  onDismiss?: () => void;
}

export const SenderConfigurationBanner: React.FC<SenderConfigurationBannerProps> = ({
  show,
  onDismiss
}) => {
  if (!show) return null;

  return (
    <Alert className="border-orange-200 bg-orange-50 mb-6">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="flex items-center justify-between">
        <div>
          <p className="font-medium text-orange-800 mb-1">
            Email service not configured
          </p>
          <p className="text-sm text-orange-700">
            To send campaigns, you need to configure your email domain or add the RESEND_API_KEY.
          </p>
          <div className="mt-3 space-y-1 text-sm text-orange-700">
            <p><strong>Option 1:</strong> Set up your custom domain for professional branding</p>
            <p><strong>Option 2:</strong> Add RESEND_API_KEY in Supabase Edge Functions → Secrets</p>
          </div>
        </div>
        <div className="flex flex-col space-y-2 ml-4">
          <Button asChild size="sm" variant="outline">
            <Link to="/crm/settings/email-auth">
              <Settings className="h-4 w-4 mr-2" />
              Setup Domain
            </Link>
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={onDismiss}
            className="text-xs"
          >
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};