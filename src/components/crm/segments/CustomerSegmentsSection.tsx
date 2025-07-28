import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, ArrowRight } from 'lucide-react';
import { SegmentOverviewCard } from './SegmentOverviewCard';
import { useNavigate } from 'react-router-dom';

// Predefined segments with estimated counts
const predefinedSegments = [
  {
    id: 'loyalty-members',
    name: 'Loyalty Members',
    description: 'Customers enrolled in your loyalty program with active engagement',
    estimatedCount: 245,
    icon: 'crown' as const,
  },
  {
    id: 'high-value',
    name: 'High-Value Customers',
    description: 'Top spending customers who drive significant revenue',
    estimatedCount: 89,
    icon: 'trending' as const,
  },
  {
    id: 'new-customers',
    name: 'New Customers',
    description: 'Recent customers who made their first purchase within 30 days',
    estimatedCount: 156,
    icon: 'users' as const,
  },
  {
    id: 'lapsed-customers',
    name: 'Lapsed Customers',
    description: 'Previously active customers who haven\'t purchased in 90+ days',
    estimatedCount: 312,
    icon: 'mail' as const,
  },
  {
    id: 'seasonal-shoppers',
    name: 'Seasonal Shoppers',
    description: 'Customers who typically purchase during specific seasons or holidays',
    estimatedCount: 178,
    icon: 'gift' as const,
  },
  {
    id: 'frequent-buyers',
    name: 'Frequent Buyers',
    description: 'Customers with 3+ purchases in the last 6 months',
    estimatedCount: 134,
    icon: 'shopping' as const,
  },
];

export const CustomerSegmentsSection: React.FC = () => {
  const navigate = useNavigate();

  const handleViewAllSegments = () => {
    navigate('/crm/segments');
  };

  const handleCreateCampaign = (segmentId: string) => {
    // Future: Navigate to campaign creation with pre-selected segment
    console.log('Create campaign for segment:', segmentId);
  };

  const handleViewSegmentDetails = (segmentId: string) => {
    navigate(`/crm/segments?highlight=${segmentId}`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Customer Segments
          </CardTitle>
          <Button variant="outline" onClick={handleViewAllSegments}>
            View All
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {predefinedSegments.map((segment) => (
            <SegmentOverviewCard
              key={segment.id}
              name={segment.name}
              description={segment.description}
              estimatedCount={segment.estimatedCount}
              icon={segment.icon}
              isSystem={true}
              onCreateCampaign={() => handleCreateCampaign(segment.id)}
              onViewDetails={() => handleViewSegmentDetails(segment.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};