import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Facebook, Instagram, Link, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ConnectSocialCTAProps {
  variant?: 'card' | 'inline' | 'button';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  redirectTo?: string; // URL to return to after connecting
}

export const ConnectSocialCTA: React.FC<ConnectSocialCTAProps> = ({
  variant = 'card',
  size = 'default',
  className = '',
  redirectTo
}) => {
  const navigate = useNavigate();

  const handleConnect = () => {
    const searchParams = new URLSearchParams();
    if (redirectTo) {
      searchParams.set('returnTo', redirectTo);
    }
    
    const queryString = searchParams.toString();
    const url = `/social-media${queryString ? `?${queryString}` : ''}`;
    
    navigate(url);
  };

  if (variant === 'button') {
    return (
      <Button
        onClick={handleConnect}
        variant="outline"
        size={size}
        className={`${className} border-dashed border-primary/50 hover:border-primary text-primary hover:bg-primary/5`}
      >
        <Link className="w-4 h-4 mr-2" />
        Connect Social Account
      </Button>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`${className} bg-blue-50 border border-blue-200 rounded-lg p-4`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Link className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-blue-900 mb-1">Connect Social Accounts</h3>
            <p className="text-sm text-blue-700 mb-3">
              Connect your Facebook and Instagram accounts to publish content directly.
            </p>
            <Button
              onClick={handleConnect}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Go to Connections
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Default card variant
  return (
    <Card className={`${className} border-dashed border-primary/50`}>
      <CardHeader className="text-center pb-4">
        <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Link className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-lg">Connect Social Accounts</CardTitle>
        <CardDescription className="text-base">
          Connect your Facebook and Instagram accounts to start publishing content directly from here.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <div className="flex items-center justify-center gap-6 mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Facebook className="w-5 h-5 text-blue-600" />
            Facebook
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Instagram className="w-5 h-5 text-pink-500" />
            Instagram
          </div>
        </div>
        
        <Button
          onClick={handleConnect}
          className="w-full bg-primary hover:bg-primary/90"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Connect Accounts
        </Button>
      </CardContent>
    </Card>
  );
};