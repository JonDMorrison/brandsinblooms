
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, MessageSquare, Users, TrendingUp, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmptyStateSectionProps {
  customerCount: number;
  campaignCount: number;
}

export const EmptyStateSection: React.FC<EmptyStateSectionProps> = ({
  customerCount,
  campaignCount
}) => {
  if (campaignCount > 0) return null;

  return (
    <Card className="border border-gray-200">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Mail className="h-8 w-8 text-gray-600" />
        </div>
        <CardTitle className="text-xl font-semibold text-gray-900">
          Ready to launch your first campaign?
        </CardTitle>
        <p className="text-gray-600 max-w-md mx-auto">
          {customerCount > 0 
            ? `You have ${customerCount} contacts ready for your first campaign.` 
            : "Import your contacts to start sending targeted campaigns."
          }
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Performance Preview */}
        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
          <h3 className="font-medium text-gray-900 mb-4">
            Track your performance metrics:
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
              <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-lg mx-auto mb-2">
                <Mail className="h-5 w-5 text-gray-600" />
              </div>
              <div className="text-xl font-semibold text-gray-400">--</div>
              <div className="text-xs text-gray-500">Open Rate</div>
            </div>
            
            <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
              <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-lg mx-auto mb-2">
                <TrendingUp className="h-5 w-5 text-gray-600" />
              </div>
              <div className="text-xl font-semibold text-gray-400">--</div>
              <div className="text-xs text-gray-500">Click Rate</div>
            </div>
            
            <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
              <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-lg mx-auto mb-2">
                <MessageSquare className="h-5 w-5 text-gray-600" />
              </div>
              <div className="text-xl font-semibold text-gray-400">--</div>
              <div className="text-xs text-gray-500">Delivery Rate</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {customerCount > 0 ? (
            <>
              <Button asChild>
                <Link to="/crm/campaigns/new">
                  <Mail className="h-4 w-4 mr-2" />
                  Create Campaign
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/crm/segments">
                  <Users className="h-4 w-4 mr-2" />
                  Create Segments
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild>
                <Link to="/crm/customers">
                  <Users className="h-4 w-4 mr-2" />
                  Import Contacts
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/crm/import">
                  View Import Options
                </Link>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
