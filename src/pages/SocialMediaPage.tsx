
import React from 'react';
import { ProtectedPageWrapper } from '@/components/ProtectedPageWrapper';
import { PostPerformanceTracker } from '@/components/analytics/PostPerformanceTracker';
import { AutoScheduler } from '@/components/scheduling/AutoScheduler';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Calendar, TrendingUp, Zap } from 'lucide-react';

const SocialMediaPage = () => {
  return (
    <ProtectedPageWrapper>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
            <TrendingUp className="w-10 h-10 text-blue-600" />
            Social Media Management
          </h1>
          <p className="text-lg text-gray-600 font-medium">
            Optimize your social media performance with smart scheduling and analytics
          </p>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="scheduling" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Auto-Scheduling
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <PostPerformanceTracker />
          </TabsContent>

          <TabsContent value="scheduling">
            <AutoScheduler />
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedPageWrapper>
  );
};

export default SocialMediaPage;
