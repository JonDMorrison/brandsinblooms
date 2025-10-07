import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Facebook, Instagram, CheckCircle, RefreshCw, Settings } from 'lucide-react';

interface MetaConnectionSuccessProps {
  facebookConnection: any;
  instagramConnection: any;
  onSyncAnalytics: () => void;
  onManageConnections: () => void;
}

export const MetaConnectionSuccess = ({ 
  facebookConnection, 
  instagramConnection,
  onSyncAnalytics,
  onManageConnections
}: MetaConnectionSuccessProps) => {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-2xl font-bold text-gray-900">
          Your Meta Accounts
        </CardTitle>
        <p className="text-gray-600 mt-2">
          Manage your Facebook and Instagram connections
        </p>
      </CardHeader>
      
      <CardContent>
        <div className="bg-background rounded-xl p-6 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Meta Platforms</h3>
            <Badge className="bg-success/10 text-success hover:bg-success/10">
              Both platforms connected!
            </Badge>
          </div>
          
          <div className="flex items-center gap-4 mb-6">
            {/* Facebook Icon */}
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <Facebook className="w-6 h-6 text-white" />
            </div>
            
            {/* Instagram Icon */}
            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <Instagram className="w-6 h-6 text-white" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Facebook Status */}
            <div className="flex items-center gap-3">
              <Facebook className="w-5 h-5 text-blue-600" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">Facebook</span>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">Connected</span>
                </div>
                <p className="text-sm text-gray-500">
                  Facebook: {facebookConnection?.platform_account_name || 'Connected'}
                </p>
              </div>
            </div>
            
            {/* Instagram Status */}
            <div className="flex items-center gap-3">
              <Instagram className="w-5 h-5 text-purple-600" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">Instagram</span>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">Connected</span>
                </div>
                <p className="text-sm text-gray-500">
                  Instagram: {instagramConnection?.platform_account_name || 'Connected'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
            <Button 
              onClick={onSyncAnalytics}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Sync Data
            </Button>
            <Button 
              onClick={onManageConnections}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Manage Connections
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};