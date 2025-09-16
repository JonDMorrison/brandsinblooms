import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Globe, Mail, Share2, Megaphone, BarChart3 } from 'lucide-react';
import { GoogleAnalyticsCard } from './GoogleAnalyticsCard';
import { CRMAnalyticsCard } from './CRMAnalyticsCard';
import { RealAnalyticsData } from './RealAnalyticsData';
import { PostPerformanceTracker } from './PostPerformanceTracker';

interface ChannelPerformanceProps {
  gaConnected?: boolean;
  propertyId?: string;
  dateRange?: number;
}

export const ChannelPerformance = ({
  gaConnected = false,
  propertyId,
  dateRange = 30
}: ChannelPerformanceProps) => {
  const [activeTab, setActiveTab] = useState('website');

  const channels = [
    {
      id: 'website',
      name: 'Website Traffic',
      icon: Globe,
      description: 'Visitor behavior and conversion tracking',
      status: gaConnected ? 'connected' : 'setup-required'
    },
    {
      id: 'social',
      name: 'Social Media',
      icon: Share2,
      description: 'Engagement across social platforms',
      status: 'connected'
    },
    {
      id: 'email',
      name: 'Email Marketing',
      icon: Mail,
      description: 'Campaign performance and customer engagement',
      status: 'connected'
    },
    {
      id: 'campaigns',
      name: 'Marketing Campaigns',
      icon: Megaphone,
      description: 'Multi-channel campaign effectiveness',
      status: 'connected'
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>;
      case 'setup-required':
        return <Badge variant="outline" className="text-yellow-700 border-yellow-300">Setup Required</Badge>;
      default:
        return <Badge variant="outline">Inactive</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Channel Performance</h2>
          <p className="text-muted-foreground">Detailed analytics by marketing channel</p>
        </div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Last {dateRange} days</span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <TabsTrigger 
                key={channel.id} 
                value={channel.id}
                className="flex items-center gap-2 text-xs"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{channel.name}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Channel Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {channels.map((channel) => {
            const Icon = channel.icon;
            const isActive = activeTab === channel.id;
            
            return (
              <Card 
                key={channel.id}
                className={`transition-all cursor-pointer ${
                  isActive ? 'ring-2 ring-primary border-primary' : 'hover:shadow-md'
                }`}
                onClick={() => setActiveTab(channel.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    {getStatusBadge(channel.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <h3 className="font-semibold mb-1">{channel.name}</h3>
                  <p className="text-xs text-muted-foreground">{channel.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Channel Content */}
        <TabsContent value="website" className="space-y-4">
          <div className="grid gap-6">
            {gaConnected && propertyId ? (
              <GoogleAnalyticsCard 
                propertyId={propertyId} 
                dateRange={dateRange} 
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Website Analytics Setup
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Connect Google Analytics</h3>
                    <p className="text-muted-foreground mb-4">
                      Get detailed insights about your website visitors and their behavior
                    </p>
                    <Badge variant="outline">Setup Required</Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          <RealAnalyticsData />
          <div className="mt-6">
            <PostPerformanceTracker />
          </div>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <CRMAnalyticsCard />
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  Campaign Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Multi-Channel Campaigns</h3>
                  <p className="text-muted-foreground">
                    Unified view of your marketing campaigns across all channels
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};