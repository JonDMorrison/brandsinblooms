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
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader className="text-center">
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-4">
          <span className="text-3xl">🌼</span>
        </div>
        <CardTitle className="text-2xl text-blue-800">
          Let's grow your community!
        </CardTitle>
        <p className="text-blue-700 max-w-md mx-auto">
          You haven't sent a campaign yet, but you're ready to connect with {customerCount > 0 ? customerCount : 'your'} customers.
          {customerCount === 0 && " Start by adding some customers to your database."}
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Sample Performance Preview */}
        <div className="bg-white/60 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-gray-800 mb-4">
            Here's what your performance dashboard will look like:
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white/80 rounded-lg border border-gray-200">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-2">
                <Mail className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-gray-400">--</div>
              <div className="text-sm text-gray-500">Email Open Rate</div>
            </div>
            
            <div className="text-center p-4 bg-white/80 rounded-lg border border-gray-200">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-2">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-400">--</div>
              <div className="text-sm text-gray-500">Click Through Rate</div>
            </div>
            
            <div className="text-center p-4 bg-white/80 rounded-lg border border-gray-200">
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-2">
                <MessageSquare className="h-6 w-6 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-gray-400">--</div>
              <div className="text-sm text-gray-500">SMS Delivery Rate</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {customerCount > 0 ? (
            <>
              <Button asChild className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                <Link to="/crm/campaigns/new">
                  <Mail className="h-4 w-4 mr-2" />
                  Create First Campaign
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/crm/segments">
                  <Users className="h-4 w-4 mr-2" />
                  Explore Segments
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                <Link to="/crm/customers">
                  <Users className="h-4 w-4 mr-2" />
                  Add Your First Customers
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/crm/import">
                  Import Customer List
                </Link>
              </Button>
            </>
          )}
        </div>
        
        {/* Inspirational message */}
        <div className="text-center text-sm text-blue-600 bg-white/40 rounded-lg p-4">
          💡 <strong>Pro tip:</strong> Garden centers using email marketing see 25% more repeat customers during peak seasons!
        </div>
      </CardContent>
    </Card>
  );
};