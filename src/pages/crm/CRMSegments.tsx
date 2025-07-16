import React, { useState } from 'react';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Target, 
  Users,
  Filter,
  Calendar,
  Sparkles
} from 'lucide-react';

const CRMSegments = () => {
  const prebuiltSegments = [
    {
      name: "New Garden Enthusiasts",
      description: "Customers who joined in the last 30 days with 'Newbie' persona",
      count: 0,
      conditions: "Persona = Newbie AND Created Date < 30 days",
      color: "bg-blue-100 text-blue-800"
    },
    {
      name: "Spring Prep Customers",
      description: "Customers who purchased soil, seeds, or tools in February-March",
      count: 0,
      conditions: "Purchase History contains 'soil' OR 'seeds' AND Purchase Date = Feb-Mar",
      color: "bg-green-100 text-green-800"
    },
    {
      name: "High Value Regulars",
      description: "Regular customers with lifetime value over $500",
      count: 0,
      conditions: "Persona = Regular AND Lifetime Value > $500",
      color: "bg-purple-100 text-purple-800"
    },
    {
      name: "Inactive Customers",
      description: "Customers who haven't purchased in the last 90 days",
      count: 0,
      conditions: "Last Purchase Date > 90 days ago",
      color: "bg-orange-100 text-orange-800"
    }
  ];

  return (
    <SubscriptionGate 
      requiredPlan="bloom" 
      feature="Customer Segmentation"
    >
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Customer Segments</h1>
            <p className="text-muted-foreground">
              Create targeted groups for personalized marketing campaigns
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Segment
          </Button>
        </div>

        {/* Pre-built Segments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Garden Center Pre-built Segments
              </CardTitle>
              <Badge variant="outline">Ready to Use</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {prebuiltSegments.map((segment, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-foreground">{segment.name}</h3>
                      <p className="text-sm text-muted-foreground">{segment.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-medium">{segment.count} customers</div>
                        <div className="text-xs text-muted-foreground">Auto-updates</div>
                      </div>
                      <Button variant="outline" size="sm">
                        Activate
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                      {segment.conditions}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Custom Segments */}
        <Card>
          <CardHeader>
            <CardTitle>Your Custom Segments</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Empty State */}
            <div className="text-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No custom segments yet</h3>
              <p className="text-muted-foreground mb-4">
                Create custom segments based on customer behavior, preferences, or purchase history
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Segment
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Segmentation Tips */}
        <Card>
          <CardHeader>
            <CardTitle>Effective Garden Center Segmentation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">By Experience Level</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Newbies need basic tips, while experts want advanced techniques
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Seasonal Behavior</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Group customers by when they typically shop for plants
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Purchase Patterns</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Segment by plant types, garden size, or spending habits
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SubscriptionGate>
  );
};

export default CRMSegments;