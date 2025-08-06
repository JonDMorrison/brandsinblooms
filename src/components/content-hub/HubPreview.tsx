import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Smartphone, Zap, Image, Type, Video, Gift, CreditCard } from 'lucide-react';

interface HubPreviewProps {
  campaign: {
    id: string;
    title: string;
    slug?: string;
  };
  blocks: Array<{
    id?: string;
    type: string;
    payload_json: any;
    sort_order: number;
  }>;
  className?: string;
}

export const HubPreview: React.FC<HubPreviewProps> = ({ 
  campaign, 
  blocks, 
  className 
}) => {
  const sortedBlocks = [...blocks].sort((a, b) => a.sort_order - b.sort_order);

  const getBlockIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-3 h-3" />;
      case 'text': 
      case 'rich_text': return <Type className="w-3 h-3" />;
      case 'video': return <Video className="w-3 h-3" />;
      case 'offer_card': return <Gift className="w-3 h-3" />;
      case 'coupon': return <CreditCard className="w-3 h-3" />;
      default: return <Zap className="w-3 h-3" />;
    }
  };

  const getBlockPreview = (block: any) => {
    const { type, payload_json } = block;
    
    switch (type) {
      case 'image':
        return payload_json.url ? (
          <div className="bg-gray-100 rounded h-16 flex items-center justify-center text-xs text-gray-500">
            📷 Image
          </div>
        ) : (
          <div className="bg-gray-50 rounded h-16 flex items-center justify-center text-xs text-gray-400">
            No image set
          </div>
        );
      
      case 'text':
      case 'rich_text':
        return (
          <div className="text-xs">
            {payload_json.title && (
              <div className="font-medium mb-1 truncate">{payload_json.title}</div>
            )}
            <div className="text-gray-600 line-clamp-2">
              {payload_json.content || payload_json.text || 'No content'}
            </div>
          </div>
        );
      
      case 'offer_card':
        return (
          <div className="text-xs">
            <div className="font-medium mb-1 truncate">
              {payload_json.title || 'Special Offer'}
            </div>
            <div className="flex items-center gap-2 text-green-600">
              {payload_json.price && <span className="font-bold">${payload_json.price}</span>}
              {payload_json.original_price && (
                <span className="text-gray-400 line-through text-xs">
                  ${payload_json.original_price}
                </span>
              )}
            </div>
          </div>
        );
      
      case 'video':
        return (
          <div className="bg-black rounded h-16 flex items-center justify-center text-white text-xs">
            ▶️ Video
          </div>
        );
      
      case 'loyalty_widget':
        return (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded h-16 flex items-center justify-center text-white text-xs font-bold">
            ⭐ {payload_json.points || '0'} Points
          </div>
        );
      
      case 'coupon':
        return (
          <div className="text-xs">
            <div className="font-medium mb-1 truncate">
              {payload_json.title || 'Coupon'}
            </div>
            <div className="bg-gray-100 px-2 py-1 rounded text-center font-mono">
              {payload_json.code || 'CODE'}
            </div>
          </div>
        );
      
      default:
        return (
          <div className="text-xs text-gray-500">
            {type} block
          </div>
        );
    }
  };

  const getHubUrl = () => {
    if (!campaign.slug) return '';
    return `https://gc.ly/${campaign.slug}`;
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Mobile Preview
            </CardTitle>
            <CardDescription>
              How your content hub will appear on mobile devices
            </CardDescription>
          </div>
          {campaign.slug && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(getHubUrl(), '_blank')}
              className="flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Preview
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="mx-auto max-w-sm">
          {/* Mobile Frame */}
          <div className="bg-gray-900 rounded-[2rem] p-2">
            <div className="bg-white rounded-[1.5rem] overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 text-center">
                <h2 className="font-bold text-sm truncate">{campaign.title}</h2>
                <p className="text-xs opacity-90">Exclusive offers just for you</p>
              </div>
              
              {/* Content Blocks */}
              <div className="p-3 space-y-3 max-h-64 overflow-y-auto">
                {sortedBlocks.length > 0 ? (
                  sortedBlocks.map((block, index) => (
                    <div
                      key={block.id || index}
                      className="border border-gray-200 rounded-lg p-2"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs h-5 px-1">
                          {getBlockIcon(block.type)}
                          <span className="ml-1 capitalize">{block.type.replace('_', ' ')}</span>
                        </Badge>
                      </div>
                      {getBlockPreview(block)}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-xs">No content blocks yet</div>
                    <div className="text-xs mt-1">Add blocks to see preview</div>
                  </div>
                )}
              </div>
              
              {/* Bottom Bar */}
              <div className="bg-gray-50 p-3 border-t flex justify-center gap-2">
                <div className="bg-gray-200 rounded px-2 py-1 text-xs flex items-center gap-1">
                  ❤️ Save
                </div>
                <div className="bg-gray-200 rounded px-2 py-1 text-xs flex items-center gap-1">
                  🔗 Share
                </div>
                <div className="bg-gray-200 rounded px-2 py-1 text-xs flex items-center gap-1">
                  📱 QR
                </div>
              </div>
            </div>
          </div>
          
          {/* URL Display */}
          {campaign.slug && (
            <div className="mt-3 text-center">
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                gc.ly/{campaign.slug}
              </code>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};