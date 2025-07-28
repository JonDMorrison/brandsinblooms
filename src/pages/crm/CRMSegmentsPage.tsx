import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Target, Plus, Search, RefreshCw } from 'lucide-react';
import { useCRMSegments } from '@/hooks/useCRMSegments';
import { SegmentCard } from '@/components/crm/segments/SegmentCard';
import { CustomSegmentModal } from '@/components/crm/segments/CustomSegmentModal';
import { SegmentOverviewCard } from '@/components/crm/segments/SegmentOverviewCard';

// Predefined segments data
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

export const CRMSegmentsPage: React.FC = () => {
  const { segments, loading, searchTerm, setSearchTerm, fetchSegments, createSegment, deleteSegment } = useCRMSegments();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);

  const handleCreateSegment = () => {
    setShowCustomBuilder(true);
  };

  const handleSaveCustomSegment = async (segmentData: any) => {
    const success = await createSegment(segmentData);
    if (success) {
      setShowCustomBuilder(false);
    }
  };

  const handleCreateCampaign = (segmentId: string) => {
    // Future: Navigate to campaign creation with pre-selected segment
    console.log('Create campaign for segment:', segmentId);
  };

  const handleViewSegmentDetails = (segmentId: string) => {
    console.log('View segment details:', segmentId);
  };

  // Filter predefined segments based on search term
  const filteredPredefinedSegments = predefinedSegments.filter(segment =>
    segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    segment.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Customer Segments</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSegments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleCreateSegment}>
            <Plus className="h-4 w-4 mr-2" />
            Create Segment
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search all segments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Predefined Segments */}
        {filteredPredefinedSegments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                System Segments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPredefinedSegments.map((segment) => (
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
        )}

        {/* Custom Segments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Custom Segments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading custom segments...</p>
              </div>
            ) : segments.length === 0 ? (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No custom segments found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? 'No custom segments match your search.' : 'Create your first custom segment to start targeting specific customer groups.'}
                </p>
                {!searchTerm && (
                  <Button onClick={handleCreateSegment}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Custom Segment
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {segments.map((segment) => (
                  <SegmentCard
                    key={segment.id}
                    segment={segment}
                    onDelete={deleteSegment}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CustomSegmentModal
        open={showCustomBuilder}
        onSave={handleSaveCustomSegment}
        onCancel={() => setShowCustomBuilder(false)}
      />
    </div>
  );
};
