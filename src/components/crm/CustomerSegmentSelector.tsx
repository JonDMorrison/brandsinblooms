import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Plus, X } from "lucide-react";
import { useCustomerSegments } from "@/hooks/useCustomerSegments";
import { useCRMSegments } from "@/hooks/useCRMSegments";

interface CustomerSegmentSelectorProps {
  customerId: string;
}

export const CustomerSegmentSelector = ({ customerId }: CustomerSegmentSelectorProps) => {
  const [showSelector, setShowSelector] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);

  const { customerSegments, isLoading, addSegments, removeSegment } = useCustomerSegments(customerId);
  const { segments: availableSegments, loading: segmentsLoading } = useCRMSegments();

  // Filter available segments to exclude already assigned ones
  const assignedSegmentIds = customerSegments.map(cs => cs.segment_id);
  const unassignedSegments = availableSegments.filter(
    segment => !assignedSegmentIds.includes(segment.id) &&
    segment.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSegmentToggle = (segmentId: string, checked: boolean) => {
    if (checked) {
      setSelectedSegmentIds(prev => [...prev, segmentId]);
    } else {
      setSelectedSegmentIds(prev => prev.filter(id => id !== segmentId));
    }
  };

  const handleAddSelectedSegments = () => {
    if (selectedSegmentIds.length > 0) {
      addSegments(selectedSegmentIds);
      setSelectedSegmentIds([]);
      setShowSelector(false);
      setSearchTerm("");
    }
  };

  const handleRemoveSegment = (segmentId: string) => {
    removeSegment(segmentId);
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading segments...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Segments</Label>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setShowSelector(!showSelector)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Segments
        </Button>
      </div>

      {/* Display assigned segments */}
      {customerSegments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {customerSegments.map((customerSegment) => (
            <Badge 
              key={customerSegment.id}
              variant="outline" 
              className="inline-flex items-center gap-1.5 bg-brand-teal/10 border-brand-teal/20 text-brand-teal"
            >
              <Users className="h-3 w-3" />
              <span className="font-medium">{customerSegment.segment.name}</span>
              <span className="text-xs opacity-75">
                ({customerSegment.segment.customer_count})
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => handleRemoveSegment(customerSegment.segment_id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No segments assigned</div>
      )}

      {/* Segment selection interface */}
      {showSelector && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add Customer to Segments</CardTitle>
            <Input
              placeholder="Search segments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-2"
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {segmentsLoading ? (
              <div className="text-sm text-muted-foreground">Loading available segments...</div>
            ) : unassignedSegments.length > 0 ? (
              <>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {unassignedSegments.map((segment) => (
                    <div key={segment.id} className="flex items-start space-x-3 p-2 hover:bg-muted/50 rounded-md">
                      <Checkbox
                        id={segment.id}
                        checked={selectedSegmentIds.includes(segment.id)}
                        onCheckedChange={(checked) => handleSegmentToggle(segment.id, !!checked)}
                      />
                      <div className="flex-1 min-w-0">
                        <label htmlFor={segment.id} className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{segment.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {segment.customer_count} customers
                            </Badge>
                          </div>
                          {segment.description && (
                            <p className="text-xs text-muted-foreground mt-1">{segment.description}</p>
                          )}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2 pt-3 border-t">
                  <Button 
                    onClick={handleAddSelectedSegments}
                    disabled={selectedSegmentIds.length === 0}
                    size="sm"
                  >
                    Add Selected ({selectedSegmentIds.length})
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowSelector(false);
                      setSelectedSegmentIds([]);
                      setSearchTerm("");
                    }}
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                {searchTerm ? 'No segments match your search' : 'All available segments are already assigned'}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};