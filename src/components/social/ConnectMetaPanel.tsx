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
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
      connected 
        ? 'bg-[#E6F4EA] text-[#1B8747]' 
        : 'bg-[#F2F2F2] text-[#666]'
    }`}>
      <div className={`w-2 h-2 rounded-full ${
        connected ? 'bg-[#1B8747]' : 'border border-[#666]'
      }`} />
      {connected ? 'Connected' : 'Not connected'}
    </div>
  );

  const PlatformCard: React.FC<{
    icon: React.ComponentType<{ className?: string }>;
    name: string;
    accountName?: string;
    connected: boolean;
  }> = ({ icon: Icon, name, accountName, connected }) => (
    <div className="bg-[#F8FAF9] border border-[#E0E0E0] rounded-lg p-2 relative transition-shadow duration-200 hover:shadow-[0_2px_4px_rgba(0,0,0,0.06)] flex-1">
      <div className="absolute top-2 right-2">
        <StatusBadge connected={connected} />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-6 h-6" />
        <span className="text-base font-semibold text-black">{name}</span>
      </div>
      <div className="text-sm text-[#666] font-normal">
        {connected && accountName ? accountName : 'Not connected'}
      </div>
    </div>
  );

  return (
    <div className="bg-[#ECF9F1] p-4 rounded-lg max-w-[800px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-black">Meta Platforms</h2>
        <Button
          onClick={onLinkAccount}
          className="bg-[#1B8747] hover:bg-[#166A3F] text-white h-9 px-2 max-w-[100px] text-sm focus-visible:outline-2 focus-visible:outline-[#1B8747] focus-visible:outline-offset-2"
          size="sm"
        >
          Link New Account
        </Button>
      </div>

      {/* Platform Cards */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <PlatformCard
          icon={Facebook}
          name="Facebook"
          accountName={facebook.accountName}
          connected={facebook.connected}
        />
        <PlatformCard
          icon={Instagram}
          name="Instagram"
          accountName={instagram.accountName}
          connected={instagram.connected}
        />
      </div>

      {/* Tip Box */}
      <div className="bg-[#F1F7FF] border border-[#BBD7FF] rounded-md px-4 py-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 text-[#1B8747] flex-shrink-0" />
          <p className="text-sm text-[#333] font-normal">
            <span className="font-medium">Tip:</span> The 'Link New Account' button will connect both your Facebook pages and Instagram business accounts in one go.
          </p>
        </div>
      </div>
    </div>
  );
};