import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Target, Plus, Search, RefreshCw } from 'lucide-react';
import { useCRMSegments } from '@/hooks/useCRMSegments';
import { SegmentCard } from '@/components/crm/segments/SegmentCard';
import { CustomSegmentModal } from '@/components/crm/segments/CustomSegmentModal';

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Segment Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search segments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading segments...</p>
              </div>
            ) : segments.length === 0 ? (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No segments found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? 'No segments match your search.' : 'Create your first segment to start targeting customers.'}
                </p>
                {!searchTerm && (
                  <Button onClick={handleCreateSegment}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Segment
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
          </div>
        </CardContent>
      </Card>

      <CustomSegmentModal
        open={showCustomBuilder}
        onSave={handleSaveCustomSegment}
        onCancel={() => setShowCustomBuilder(false)}
      />
    </div>
  );
};
