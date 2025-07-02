import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SuccessMetricsDashboard } from '@/components/metrics/SuccessMetricsDashboard';
import { EngagementBooster } from '@/components/retention/EngagementBooster';
import { PostPerformanceTracker } from '@/components/analytics/PostPerformanceTracker';
import { TokenUsageDashboard } from '@/components/tokens/TokenUsageDashboard';
import { 
  Trophy, 
  TrendingUp, 
  Target, 
  Coins,
  Users,
  Calendar
} from 'lucide-react';

export const RetentionDashboard = () => {
  const [activeTab, setActiveTab] = useState('success');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Your Success Dashboard
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Track your progress, discover insights, and get personalized recommendations 
            to maximize your social media success.
          </p>
        </div>

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex justify-center">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="success" className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Success
              </TabsTrigger>
              <TabsTrigger value="engagement" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Engagement
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="resources" className="flex items-center gap-2">
                <Coins className="w-4 h-4" />
                Resources
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="success" className="space-y-6">
            <SuccessMetricsDashboard />
          </TabsContent>

          <TabsContent value="engagement" className="space-y-6">
            <EngagementBooster />
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <PostPerformanceTracker />
          </TabsContent>

          <TabsContent value="resources" className="space-y-6">
            <TokenUsageDashboard />
          </TabsContent>
        </Tabs>

        {/* Quick Stats Footer */}
        <Card className="bg-gradient-to-r from-gray-50 to-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-blue-900">
                    Growing Community
                  </span>
                </div>
                <p className="text-sm text-blue-700">
                  Join thousands of businesses succeeding with AI-powered content
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-900">
                    Proven Results
                  </span>
                </div>
                <p className="text-sm text-green-700">
                  Users see 40% increase in engagement with our AI content
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold text-purple-900">
                    Consistent Growth
                  </span>
                </div>
                <p className="text-sm text-purple-700">
                  Regular posting leads to 3x faster audience growth
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};