import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, X, Loader2 } from "lucide-react";
import { useCustomerSegments } from "@/hooks/useCustomerSegments";
import { useAllSegments } from "@/hooks/useAllSegments";

interface CustomerSegmentSelectorProps {
  customerId: string;
}

export const CustomerSegmentSelector = ({ customerId }: CustomerSegmentSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [processingSegments, setProcessingSegments] = useState<Set<string>>(new Set());

  const { customerSegments, isLoading, addSegments, removeSegment, isAddingSegments, isRemovingSegment } = useCustomerSegments(customerId);
  const { segments: availableSegments, loading: segmentsLoading } = useAllSegments();

  // Get assigned segment IDs for easy lookup
  const assignedSegmentIds = new Set(customerSegments.map(cs => cs.segment_id));
  
  // Filter all segments based on search term
  const filteredSegments = availableSegments.filter(segment =>
    segment.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSegmentToggle = async (segmentId: string, isCurrentlyAssigned: boolean) => {
    setProcessingSegments(prev => new Set(prev).add(segmentId));
    
    try {
      if (isCurrentlyAssigned) {
        await removeSegment(segmentId);
      } else {
        await addSegments([segmentId]);
      }
    } finally {
      setProcessingSegments(prev => {
        const newSet = new Set(prev);
        newSet.delete(segmentId);
        return newSet;
      });
    }
  };

  const handleRemoveSegment = (segmentId: string) => {
    removeSegment(segmentId);
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading segments...</div>;
  }

  const assignedCount = customerSegments.length;
  const totalCount = availableSegments.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          Segments ({assignedCount}/{totalCount})
        </Label>
      </div>

      {/* Display assigned segments as badges */}
      {customerSegments.length > 0 && (
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
                disabled={isRemovingSegment}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* All segments list with real-time toggle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Segments</CardTitle>
          <Input
            placeholder="Search segments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mt-2"
          />
        </CardHeader>
        <CardContent>
          {segmentsLoading ? (
            <div className="text-sm text-muted-foreground py-4">Loading segments...</div>
          ) : filteredSegments.length > 0 ? (
            <ScrollArea className="h-64">
              <div className="space-y-2 pr-4">
                {filteredSegments.map((segment) => {
                  const isAssigned = assignedSegmentIds.has(segment.id);
                  const isProcessing = processingSegments.has(segment.id);
                  
                  return (
                    <div key={segment.id} className="flex items-start space-x-3 p-3 hover:bg-muted/50 rounded-md border border-transparent hover:border-border/50 transition-colors">
                      <div className="flex items-center justify-center w-5 h-5 mt-0.5">
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Checkbox
                            id={segment.id}
                            checked={isAssigned}
                            onCheckedChange={() => handleSegmentToggle(segment.id, isAssigned)}
                            disabled={isProcessing || isAddingSegments || isRemovingSegment}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <label htmlFor={segment.id} className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium text-sm ${isAssigned ? 'text-brand-teal' : ''}`}>
                              {segment.name}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {segment.customer_count} customers
                            </Badge>
                            {isAssigned && <Badge variant="outline" className="text-xs bg-brand-teal/10 border-brand-teal/20 text-brand-teal">Assigned</Badge>}
                          </div>
                          {segment.description && (
                            <p className="text-xs text-muted-foreground mt-1">{segment.description}</p>
                          )}
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              {searchTerm ? 'No segments match your search' : 'No segments available'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};