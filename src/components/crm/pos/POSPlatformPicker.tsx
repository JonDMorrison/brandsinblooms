import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Store, Upload, Settings, Zap } from 'lucide-react';
import { POSConnectionForm } from './POSConnectionForm';

interface POSPlatformPickerProps {
  onSelect: () => void;
  onCancel: () => void;
}

const platforms = [
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Connect your Shopify store to sync customers and orders',
    icon: Store,
    status: 'available',
    features: ['Customers', 'Orders', 'Products', 'Real-time sync']
  },
  {
    id: 'square',
    name: 'Square',
    description: 'Integrate with Square POS for customer and transaction data',
    icon: Settings,
    status: 'available',
    features: ['Customers', 'Payments', 'Items', 'Locations']
  },
  {
    id: 'counterpoint',
    name: 'Counterpoint',
    description: 'Connect your Counterpoint POS system for comprehensive data sync',
    icon: Store,
    status: 'available',
    features: ['Customers', 'Orders', 'Products', 'Multi-location']
  },
  {
    id: 'vmx',
    name: 'VMX CSV Import',
    description: 'Upload CSV files from VMX or other POS systems',
    icon: Upload,
    status: 'available',
    features: ['CSV Upload', 'Bulk Import', 'Data Validation']
  },
  {
    id: 'mock',
    name: 'Mock POS (Demo)',
    description: 'Demo integration with sample data for testing',
    icon: Zap,
    status: 'demo',
    features: ['Sample Data', 'Testing', 'Development']
  }
];

export const POSPlatformPicker: React.FC<POSPlatformPickerProps> = ({
  onSelect,
  onCancel
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  if (selectedPlatform) {
    return (
      <POSConnectionForm
        platform={selectedPlatform}
        onSuccess={onSelect}
        onCancel={() => setSelectedPlatform(null)}
      />
    );
  }

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose POS Platform</DialogTitle>
          <DialogDescription>
            Select your Point of Sale system to begin the integration process
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {platforms.map((platform) => {
            const IconComponent = platform.icon;
            return (
              <Card 
                key={platform.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedPlatform(platform.id)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconComponent className="w-8 h-8 text-primary" />
                      <div>
                        <CardTitle className="text-lg">{platform.name}</CardTitle>
                        <Badge 
                          variant={platform.status === 'demo' ? 'secondary' : 'default'}
                          className="mt-1"
                        >
                          {platform.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="mt-2">
                    {platform.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {platform.features.map((feature, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                  <Button className="w-full mt-4" size="sm">
                    Connect {platform.name}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};