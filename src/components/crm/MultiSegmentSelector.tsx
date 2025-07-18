
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Search, Users, Target, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Segment {
  id: string;
  name: string;
  description?: string;
  customer_count: number;
  type: 'predefined' | 'custom';
  persona_id?: string;
}

interface MultiSegmentSelectorProps {
  selectedSegments: Segment[];
  onSegmentsChange: (segments: Segment[]) => void;
  maxSelections?: number;
}

export const MultiSegmentSelector = ({ 
  selectedSegments, 
  onSegmentsChange,
  maxSelections = 5 
}: MultiSegmentSelectorProps) => {
  const [availableSegments, setAvailableSegments] = useState<Segment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [filteredSegments, setFilteredSegments] = useState<Segment[]>([]);

  const fetchSegments = async () => {
    try {
      setLoading(true);
      
      // Fetch predefined segments
      const { data: predefinedSegments, error: predefinedError } = await supabase
        .from('crm_segments')
        .select('*')
        .order('name');

      if (predefinedError) throw predefinedError;

      // Fetch custom segments
      const { data: customSegments, error: customError } = await supabase
        .from('custom_segments')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (customError) throw customError;

      const allSegments: Segment[] = [
        ...(predefinedSegments || []).map(seg => ({
          id: seg.id,
          name: seg.name,
          description: seg.description,
          customer_count: seg.customer_count || 0,
          type: 'predefined' as const,
          persona_id: seg.persona_id
        })),
        ...(customSegments || []).map(seg => ({
          id: seg.id,
          name: seg.name,
          description: undefined,
          customer_count: seg.customer_count || 0,
          type: 'custom' as const
        }))
      ];

      setAvailableSegments(allSegments);
    } catch (error) {
      console.error('Error fetching segments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSegments();
  }, []);

  useEffect(() => {
    let filtered = availableSegments;

    if (searchTerm) {
      filtered = filtered.filter(segment =>
        segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (segment.description && segment.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredSegments(filtered);
  }, [availableSegments, searchTerm]);

  const handleSegmentToggle = (segment: Segment, checked: boolean) => {
    if (checked) {
      if (selectedSegments.length >= maxSelections) {
        toast.error(`You can select up to ${maxSelections} segments`);
        return;
      }
      onSegmentsChange([...selectedSegments, segment]);
    } else {
      onSegmentsChange(selectedSegments.filter(s => s.id !== segment.id));
    }
  };

  const removeSegment = (segmentId: string) => {
    onSegmentsChange(selectedSegments.filter(s => s.id !== segmentId));
  };

  const getTotalAudience = () => {
    return selectedSegments.reduce((total, segment) => total + segment.customer_count, 0);
  };

  const isSegmentSelected = (segmentId: string) => {
    return selectedSegments.some(s => s.id === segmentId);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selected Segments Summary */}
      {selectedSegments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Selected Audience ({selectedSegments.length}/{maxSelections})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {selectedSegments.map((segment) => (
                  <Badge 
                    key={segment.id} 
                    variant="secondary" 
                    className="flex items-center gap-1 pr-1"
                  >
                    <span>{segment.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({segment.customer_count.toLocaleString()})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => removeSegment(segment.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total Audience Size:</span>
                <span className="font-bold text-primary">
                  {getTotalAudience().toLocaleString()} contacts
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Segment Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select Audience Segments
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search segments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredSegments.map((segment) => {
              const isSelected = isSegmentSelected(segment.id);
              const isDisabled = !isSelected && selectedSegments.length >= maxSelections;
              
              return (
                <div
                  key={segment.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : isDisabled 
                        ? 'border-gray-200 bg-gray-50 opacity-50' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Checkbox
                    id={segment.id}
                    checked={isSelected}
                    disabled={isDisabled}
                    onCheckedChange={(checked) => handleSegmentToggle(segment, checked as boolean)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <label 
                        htmlFor={segment.id}
                        className={`font-medium cursor-pointer ${isDisabled ? 'cursor-not-allowed' : ''}`}
                      >
                        {segment.name}
                      </label>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={segment.type === 'predefined' ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {segment.type === 'predefined' ? 'Smart' : 'Custom'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {segment.customer_count.toLocaleString()} contacts
                        </span>
                      </div>
                    </div>
                    {segment.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {segment.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            
            {filteredSegments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No segments found matching your search</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
