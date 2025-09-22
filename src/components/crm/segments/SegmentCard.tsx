
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SegmentDetailsModal } from './SegmentDetailsModal';

interface Segment {
  id: string;
  name: string;
  description?: string;
  conditions: any;
  customer_count: number;
  auto_update: boolean;
  created_at: string;
}

interface SegmentCardProps {
  segment: Segment;
  onSegmentUpdate?: () => void;
}

export const SegmentCard: React.FC<SegmentCardProps> = ({ segment, onSegmentUpdate }) => {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const navigate = useNavigate();

  const getFilterCount = () => {
    return segment.conditions?.filters?.length || 0;
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{segment.name}</CardTitle>
            </div>
          </div>
          {segment.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {segment.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-0 flex flex-col flex-1">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {segment.customer_count} customers
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {getFilterCount()} {getFilterCount() === 1 ? 'filter' : 'filters'}
              </Badge>
              {segment.auto_update && (
                <Badge variant="outline">Auto-update</Badge>
              )}
            </div>
            
            <div className="text-xs text-muted-foreground">
              Created {new Date(segment.created_at).toLocaleDateString()}
            </div>
          </div>
            
          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => {
                console.log('🔍 View Details clicked for segment:', segment.name, segment.id);
                console.log('🔍 Current showDetailsModal state:', showDetailsModal);
                setShowDetailsModal(true);
                console.log('🔍 Setting showDetailsModal to true');
              }}
            >
              View Details
            </Button>
            <Button 
              size="sm" 
              className="flex-1"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🎯 Create Campaign clicked for segment:', segment.id, segment.name);
                try {
                  // Navigate to campaign creation with pre-selected segment
                  navigate(`/crm/campaigns/new?segmentId=${segment.id}`);
                  console.log('✅ Navigation completed to:', `/crm/campaigns/new?segmentId=${segment.id}`);
                } catch (error) {
                  console.error('❌ Navigation error:', error);
                }
              }}
            >
              Create Campaign
            </Button>
          </div>
        </CardContent>
      </Card>

      <SegmentDetailsModal
        open={showDetailsModal}
        onOpenChange={(open) => {
          console.log('🔍 Modal onOpenChange called with:', open);
          setShowDetailsModal(open);
        }}
        segment={segment}
        onSegmentUpdate={onSegmentUpdate}
      />
    </>
  );
};
