import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Target, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { SegmentSMSDialog } from './SegmentSMSDialog';

interface SegmentOption {
  id: string;
  name: string;
  description?: string;
  count: number;
  isSystem: boolean;
}

const SYSTEM_SEGMENTS: Omit<SegmentOption, 'count'>[] = [
  { id: 'perks-members', name: 'Perks Members', description: 'Loyalty program members', isSystem: true },
  { id: 'high-value', name: 'High-Value Customers', description: 'Top spenders', isSystem: true },
  { id: 'new-customers', name: 'New Customers', description: 'Recent first purchases', isSystem: true },
  { id: 'frequent-buyers', name: 'Frequent Buyers', description: '3+ purchases', isSystem: true },
];

export const SendToSegmentCard: React.FC = () => {
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState<SegmentOption | null>(null);
  const { tenant } = useTenant();

  useEffect(() => {
    if (tenant?.id) {
      fetchSegments();
    }
  }, [tenant?.id]);

  const fetchSegments = async () => {
    if (!tenant?.id) return;
    
    setLoading(true);
    try {
      // Fetch custom segments
      const { data: customSegments, error } = await supabase
        .from('crm_segments')
        .select('id, name, description, customer_count')
        .eq('tenant_id', tenant.id)
        .order('name');

      if (error) throw error;

      const customOptions: SegmentOption[] = (customSegments || []).map(s => ({
        id: s.id,
        name: s.name,
        description: s.description || undefined,
        count: s.customer_count || 0,
        isSystem: false,
      }));

      // Combine with system segments (simplified counts)
      const systemOptions: SegmentOption[] = SYSTEM_SEGMENTS.map(s => ({
        ...s,
        count: 0, // Will be shown as "system segment" instead
      }));

      setSegments([...systemOptions, ...customOptions]);
    } catch (error) {
      console.error('Error fetching segments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSegment = (segment: SegmentOption) => {
    setSelectedSegment(segment);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Send to Segment
          </CardTitle>
          <CardDescription className="text-xs">
            Send SMS to customer segments
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : segments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No segments available
            </p>
          ) : (
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {segments.slice(0, 5).map((segment) => (
                <button
                  key={segment.id}
                  onClick={() => handleSelectSegment(segment)}
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{segment.name}</span>
                    {segment.isSystem && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        System
                      </Badge>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              ))}
              {segments.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  +{segments.length - 5} more segments
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedSegment && (
        <SegmentSMSDialog
          open={!!selectedSegment}
          onOpenChange={(open) => !open && setSelectedSegment(null)}
          segmentId={selectedSegment.id}
          segmentName={selectedSegment.name}
          customerCount={selectedSegment.count}
          isSystemSegment={selectedSegment.isSystem}
        />
      )}
    </>
  );
};
