import React from 'react';
import { Facebook, Instagram, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConnectMetaPanelProps {
  connections?: {
    facebook?: {
      connected: boolean;
      accountName?: string;
    };
    instagram?: {
      connected: boolean;
      accountName?: string;
    };
  };
  onLinkAccount?: () => void;
}

export const ConnectMetaPanel: React.FC<ConnectMetaPanelProps> = ({
  connections = {},
  onLinkAccount
}) => {
  const { facebook = { connected: false }, instagram = { connected: false } } = connections;

  const StatusBadge: React.FC<{ connected: boolean }> = ({ connected }) => (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
      connected 
        ? 'bg-gradient-to-r from-success/20 to-success/10 text-success border border-success/30 shadow-sm' 
        : 'bg-gradient-to-r from-muted to-muted/80 text-muted-foreground border border-border'
    }`}>
      <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
        connected 
          ? 'bg-success shadow-sm animate-pulse' 
          : 'border-2 border-muted-foreground/50'
      }`} />
      {connected ? 'Connected' : 'Not connected'}
    </div>
  );

  const PlatformCard: React.FC<{
    icon: React.ComponentType<{ className?: string }>;
    name: string;
    accountName?: string;
    connected: boolean;
    platform: 'facebook' | 'instagram';
  }> = ({ icon: Icon, name, accountName, connected, platform }) => {
    const platformColors = {
      facebook: 'text-blue-600',
      instagram: 'text-pink-600'
    };
    
    return (
      <div className="group relative bg-gradient-to-br from-card to-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30 flex-1 card-interactive">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="absolute top-3 right-3 z-10">
          <StatusBadge connected={connected} />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg bg-gradient-to-br from-background to-muted/50 ${platformColors[platform]} transition-transform duration-300 group-hover:scale-110`}>
              <Icon className="w-6 h-6" />
            </div>
            <span className="text-lg font-semibold text-foreground">{name}</span>
          </div>
          
          <div className="text-sm text-muted-foreground font-medium">
            {connected && accountName ? (
              <span className="text-text-secondary">{accountName}</span>
            ) : (
              <span className="text-muted-foreground">Not connected</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative bg-gradient-to-br from-mint-100/80 to-mint-50/60 backdrop-blur-sm p-6 rounded-xl max-w-4xl mx-auto border border-mint-200/50 shadow-custom overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(104,190,185,0.1),transparent_50%)]" />
      </div>
      
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-text-primary bg-gradient-to-r from-text-primary to-text-secondary bg-clip-text">
            Meta Platforms
          </h2>
          <p className="text-sm text-text-tertiary mt-1">Manage your social media connections</p>
        </div>
        
        <Button
          onClick={onLinkAccount}
          className="btn-primary bg-gradient-to-r from-brand-teal to-brand-teal/90 hover:from-brand-teal/90 hover:to-brand-teal/80 text-white px-4 py-2.5 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-brand-teal/25 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
        >
          Link New Account
        </Button>
      </div>

      {/* Platform Cards */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <PlatformCard
          icon={Facebook}
          name="Facebook"
          accountName={facebook.accountName}
          connected={facebook.connected}
          platform="facebook"
        />
        <PlatformCard
          icon={Instagram}
          name="Instagram"
          accountName={instagram.accountName}
          connected={instagram.connected}
          platform="instagram"
        />
      </div>

      {/* Enhanced Tip Box */}
      <div className="relative z-10 bg-gradient-to-r from-blue-50/80 to-sky-50/60 backdrop-blur-sm border border-blue-200/50 rounded-lg px-5 py-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-full bg-gradient-to-br from-brand-teal/20 to-brand-teal/10 flex-shrink-0">
            <Info className="w-4 h-4 text-brand-teal" />
          </div>
          <div>
            <p className="text-sm text-text-secondary leading-relaxed">
              <span className="font-semibold text-text-primary">Pro Tip:</span> The 'Link New Account' button will seamlessly connect both your Facebook pages and Instagram business accounts in one streamlined process.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};