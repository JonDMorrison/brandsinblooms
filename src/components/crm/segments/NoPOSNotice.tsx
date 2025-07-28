import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Link, Database } from 'lucide-react';

export const NoPOSNotice: React.FC = () => {
  return (
    <Card className="border-orange-200 bg-orange-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <AlertCircle className="h-5 w-5" />
          No POS System Detected
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-orange-700">
            Customer segments are currently empty because no Point of Sale (POS) system is connected. 
            POS integration is essential for automatic customer data import and meaningful segmentation.
          </p>
          
          <div className="bg-white/70 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-orange-800 flex items-center gap-2">
              <Database className="h-4 w-4" />
              Why POS Integration Matters:
            </h4>
            <ul className="text-sm text-orange-700 space-y-1 ml-6">
              <li>• Automatic customer profile creation from purchases</li>
              <li>• Real-time purchase history and spending patterns</li>
              <li>• Accurate segmentation based on buying behavior</li>
              <li>• Personalized campaigns targeting specific customer groups</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
              <Link className="h-4 w-4 mr-2" />
              Connect POS System
            </Button>
            <Button variant="outline" size="sm" className="border-orange-300 text-orange-700 hover:bg-orange-100">
              Learn More
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};