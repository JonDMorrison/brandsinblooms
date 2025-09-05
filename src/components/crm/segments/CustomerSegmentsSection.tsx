import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, ArrowRight } from 'lucide-react';
import { SegmentOverviewCard } from './SegmentOverviewCard';
import { SegmentCustomersModal } from './SegmentCustomersModal';
import { useNavigate } from 'react-router-dom';
import { useSegmentCounts } from '@/hooks/useSegmentCounts';
import { usePOSConnection } from '@/hooks/usePOSConnection';
import { NoPOSNotice } from './NoPOSNotice';
import { useIsMobile } from '@/hooks/use-mobile';

// Predefined segments configuration
const predefinedSegments = [
  {
    id: 'loyalty-members' as const,
    name: 'Loyalty Members',
    description: 'Customers enrolled in your loyalty program with active engagement',
    icon: 'crown' as const,
  },
  {
    id: 'high-value' as const,
    name: 'High-Value Customers',
    description: 'Top spending customers who drive significant revenue',
    icon: 'trending' as const,
  },
  {
    id: 'new-customers' as const,
    name: 'New Customers',
    description: 'Recent customers who made their first purchase within 30 days',
    icon: 'users' as const,
  },
  {
    id: 'lapsed-customers' as const,
    name: 'Lapsed Customers',
    description: 'Previously active customers who haven\'t purchased in 90+ days',
    icon: 'mail' as const,
  },
  {
    id: 'seasonal-shoppers' as const,
    name: 'Seasonal Shoppers',
    description: 'Customers who typically purchase during specific seasons or holidays',
    icon: 'gift' as const,
  },
  {
    id: 'frequent-buyers' as const,
    name: 'Frequent Buyers',
    description: 'Customers with 3+ purchases in the last 6 months',
    icon: 'shopping' as const,
  },
];

export const CustomerSegmentsSection: React.FC = () => {
  const navigate = useNavigate();
  const { counts, loading } = useSegmentCounts();
  const { hasPOSConnection, loading: posLoading } = usePOSConnection();
  const isMobile = useIsMobile();
  const [selectedSegment, setSelectedSegment] = useState<{ id: string; name: string } | null>(null);

  const handleViewAllSegments = () => {
    navigate('/crm/segments');
  };

  const handleCreateCampaign = (segmentId: string) => {
    console.log('Create campaign for segment:', segmentId);
    navigate(`/crm/campaigns/new?segment=${segmentId}`);
  };

  const handleViewSegmentDetails = (segmentId: string) => {
    console.log('View details for segment:', segmentId);
    const segment = predefinedSegments.find(s => s.id === segmentId);
    if (segment) {
      setSelectedSegment({ id: segmentId, name: segment.name });
    }
  };

  return (
    <div className={`${isMobile ? 'mobile-space-normal' : 'space-y-4'} mobile-container`}>
      {!posLoading && !hasPOSConnection && <NoPOSNotice />}
      
      <Card className="mobile-card-elevated">
        <CardHeader className={isMobile ? 'p-4 pb-2' : ''}>
          <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`}>
            <CardTitle className={`flex items-center gap-2 ${isMobile ? 'mobile-text-heading' : ''}`}>
              <Target className={`${isMobile ? 'mobile-icon-md' : 'h-5 w-5'}`} />
              Customer Segments
            </CardTitle>
            <Button 
              variant="outline" 
              onClick={handleViewAllSegments}
              className={`${isMobile ? 'mobile-btn-secondary mobile-touch-feedback w-full' : ''} mobile-focus-ring`}
              size={isMobile ? "default" : "sm"}
            >
              View All Segments
              <ArrowRight className={`${isMobile ? 'mobile-icon-sm' : 'h-4 w-4'} ml-2`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className={isMobile ? 'p-4 pt-2' : ''}>
          <div className={`${isMobile ? 'mobile-grid-1' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} ${isMobile ? 'gap-4' : 'gap-4'}`}>
            {predefinedSegments.map((segment) => (
              <SegmentOverviewCard
                key={segment.id}
                name={segment.name}
                description={segment.description}
                estimatedCount={loading ? undefined : counts[segment.id]}
                icon={segment.icon}
                isSystem={true}
                onCreateCampaign={() => handleCreateCampaign(segment.id)}
                onViewDetails={() => handleViewSegmentDetails(segment.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Segment Customers Modal */}
      {selectedSegment && (
        <SegmentCustomersModal
          open={!!selectedSegment}
          onClose={() => setSelectedSegment(null)}
          segmentId={selectedSegment.id}
          segmentName={selectedSegment.name}
        />
      )}
    </div>
  );
};