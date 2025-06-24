
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Facebook, Instagram, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SocialConnectionCardProps {
  platform: 'facebook' | 'instagram';
  isConnected: boolean;
  accountName?: string;
  onConnect: () => void;
  onDisconnect?: () => void;
  connectButton?: React.ReactNode;
  disabled?: boolean;
}

export const SocialConnectionCard: React.FC<SocialConnectionCardProps> = ({
  platform,
  isConnected,
  accountName,
  onConnect,
  onDisconnect,
  connectButton,
  disabled = false
}) => {
  const platformConfig = {
    facebook: {
      name: 'Facebook',
      icon: Facebook,
      color: '#1877F2',
      description: 'Connect your Facebook Pages to schedule and publish posts directly from BloomSuite',
      benefits: ['Schedule posts', 'Manage multiple pages', 'Track engagement']
    },
    instagram: {
      name: 'Instagram',
      icon: Instagram,
      color: '#E4405F',
      description: 'Connect your Instagram Business account to share beautiful content with your audience',
      benefits: ['Post photos & videos', 'Schedule stories', 'View insights']
    }
  };

  const config = platformConfig[platform];
  const Icon = config.icon;

  return (
    <Card className={cn(
      "h-full transition-all duration-300 hover:shadow-lg border-2",
      isConnected 
        ? "border-green-200 bg-green-50/50" 
        : "border-gray-200 hover:border-gray-300",
      disabled && "opacity-50 cursor-not-allowed"
    )}>
      <CardContent className="p-8">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Platform Icon */}
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center",
            isConnected ? "bg-green-100" : "bg-gray-100"
          )}>
            <Icon 
              size={48} 
              style={{ color: isConnected ? '#22C55E' : config.color }}
            />
          </div>

          {/* Platform Name & Status */}
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-gray-900">
              {config.name}
            </h3>
            {isConnected && accountName && (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle size={16} />
                <span className="text-sm font-medium">Connected as {accountName}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <p className="text-gray-600 leading-relaxed max-w-sm">
            {config.description}
          </p>

          {/* Benefits */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">What you can do:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {config.benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          {/* Action Button */}
          <div className="pt-4">
            {isConnected ? (
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full"
                  disabled
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Connected
                </Button>
                {onDisconnect && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={onDisconnect}
                    className="text-gray-500 hover:text-red-600"
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            ) : (
              <div className="w-full">
                {connectButton ? (
                  connectButton
                ) : (
                  <Button 
                    onClick={onConnect}
                    className="w-full bg-garden-green hover:bg-garden-green-dark text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-200"
                    size="lg"
                    disabled={disabled}
                  >
                    Connect {config.name}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
