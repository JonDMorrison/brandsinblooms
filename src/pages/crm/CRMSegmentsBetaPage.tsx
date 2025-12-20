import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Target, 
  Plus, 
  Search, 
  RefreshCw, 
  ArrowLeft, 
  FlaskConical,
  Sparkles
} from 'lucide-react';
import { useSegmentCountsBeta } from '@/hooks/useSegmentCountsBeta';
import { SYSTEM_SEGMENTS } from '@/config/segmentDefinitions';
import { SegmentOverviewCard } from '@/components/crm/segments/SegmentOverviewCard';
import { SegmentAnalyticsDashboard } from '@/components/crm/segments/SegmentAnalyticsDashboard';
import { SmartSegmentBuilderBeta } from '@/components/crm/segments/SmartSegmentBuilderBeta';
import { useCRMSegments } from '@/hooks/useCRMSegments';
import { SegmentCard } from '@/components/crm/segments/SegmentCard';
import { useIsMobile } from '@/hooks/use-mobile';

export const CRMSegmentsBetaPage: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  
  const { counts, loading: countsLoading, refreshCounts, segments: systemSegments } = useSegmentCountsBeta();
  const { segments: customSegments, loading: segmentsLoading, fetchSegments } = useCRMSegments();

  const handleCreateSegment = () => {
    setShowBuilder(true);
  };

  const handleSaveSegment = async (segment: any) => {
    setShowBuilder(false);
    await fetchSegments();
    refreshCounts();
  };

  const handleCreateCampaign = (segmentId: string) => {
    navigate(`/crm/campaigns/new?segment=${segmentId}`);
  };

  const handleViewDetails = (segmentId: string) => {
    // For now, just log - will implement in future
    console.log('View details for:', segmentId);
  };

  const handleSegmentUpdate = async () => {
    await fetchSegments();
    refreshCounts();
  };

  // Filter segments based on search
  const filteredSystemSegments = SYSTEM_SEGMENTS.filter(segment =>
    segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    segment.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCustomSegments = customSegments.filter(segment =>
    segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (segment.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (showBuilder) {
    return (
      <div className={`${isMobile ? 'mobile-section' : 'p-6'} mobile-container`}>
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={() => setShowBuilder(false)}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Create Smart Segment</h1>
            <p className="text-muted-foreground text-sm">
              Build powerful customer segments with intelligent rules
            </p>
          </div>
        </div>
        <SmartSegmentBuilderBeta onSave={handleSaveSegment} />
      </div>
    );
  }

  return (
    <div className={`${isMobile ? 'mobile-section' : 'p-6'} mobile-space-normal mobile-container`}>
      {/* Beta Banner */}
      <Alert className="mb-6 border-primary/30 bg-primary/5">
        <FlaskConical className="h-4 w-4 text-primary" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            <strong>Beta Preview:</strong> You're testing the new Segments module with enhanced analytics and engagement metrics.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/crm/segments')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Stable
          </Button>
        </AlertDescription>
      </Alert>

      {/* Header */}
      <div className={`${isMobile ? 'mobile-space-tight' : 'flex justify-between items-center'} mb-6`}>
        <div className="flex items-center gap-3">
          <h1 className={`${isMobile ? 'mobile-text-hero' : 'text-3xl'} font-bold`}>
            Customer Segments
          </h1>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" />
            Beta
          </Badge>
        </div>
        <div className={`flex ${isMobile ? 'flex-col gap-2 mt-4' : 'gap-2'}`}>
          <Button 
            variant="outline" 
            onClick={() => { fetchSegments(); refreshCounts(); }} 
            disabled={countsLoading || segmentsLoading}
            size={isMobile ? "default" : "sm"}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${countsLoading || segmentsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={handleCreateSegment}
            size={isMobile ? "default" : "sm"}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Segment
          </Button>
        </div>
      </div>

      <div className={isMobile ? 'mobile-space-normal' : 'space-y-6'}>
        {/* Search */}
        <Card>
          <CardContent className={isMobile ? 'p-4' : 'pt-6'}>
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

        {/* Analytics Dashboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Segment Analytics
              <Badge variant="outline" className="ml-2">New</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SegmentAnalyticsDashboard counts={counts} loading={countsLoading} />
          </CardContent>
        </Card>


        {/* Custom Segments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Custom Segments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {segmentsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="text-muted-foreground mt-2">Loading custom segments...</p>
              </div>
            ) : filteredCustomSegments.length === 0 ? (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No custom segments found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? 'No segments match your search.' : 'Create your first custom segment.'}
                </p>
                {!searchTerm && (
                  <Button onClick={handleCreateSegment}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Segment
                  </Button>
                )}
              </div>
            ) : (
              <div className={`${isMobile ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}`}>
                {filteredCustomSegments.map((segment) => (
                  <SegmentCard
                    key={segment.id}
                    segment={segment}
                    onSegmentUpdate={handleSegmentUpdate}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CRMSegmentsBetaPage;
