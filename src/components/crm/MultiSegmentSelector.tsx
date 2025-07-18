
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Plus, X, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Segment {
  id: string;
  name: string;
  description?: string;
  customer_count: number;
  conditions: any;
}

interface MultiSegmentSelectorProps {
  selectedSegments: string[];
  onSegmentsChange: (segmentIds: string[]) => void;
  maxSelections?: number;
}

const MultiSegmentSelector: React.FC<MultiSegmentSelectorProps> = ({
  selectedSegments,
  onSegmentsChange,
  maxSelections = 5
}) => {
  const { user } = useAuth();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState('');

  useEffect(() => {
    if (user) {
      loadSegments();
    }
  }, [user]);

  const loadSegments = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Get user's tenant_id
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (userData?.tenant_id) {
        const { data, error } = await supabase
          .from('crm_segments')
          .select('*')
          .eq('tenant_id', userData.tenant_id)
          .order('name');

        if (error) throw error;
        setSegments(data || []);
      }
    } catch (error) {
      console.error('Error loading segments:', error);
      toast.error('Failed to load customer segments');
    } finally {
      setLoading(false);
    }
  };

  const createQuickSegment = async () => {
    if (!newSegmentName.trim() || !user) return;

    try {
      // Get user's tenant_id
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (userData?.tenant_id) {
        const { data, error } = await supabase
          .from('crm_segments')
          .insert({
            name: newSegmentName.trim(),
            description: 'Quick segment created during campaign setup',
            tenant_id: userData.tenant_id,
            user_id: user.id,
            conditions: {},
            customer_count: 0
          })
          .select()
          .single();

        if (error) throw error;

        setSegments(prev => [...prev, data]);
        setNewSegmentName('');
        setShowCreateNew(false);
        toast.success('Segment created successfully');
      }
    } catch (error) {
      console.error('Error creating segment:', error);
      toast.error('Failed to create segment');
    }
  };

  const toggleSegment = (segmentId: string) => {
    if (selectedSegments.includes(segmentId)) {
      onSegmentsChange(selectedSegments.filter(id => id !== segmentId));
    } else if (selectedSegments.length < maxSelections) {
      onSegmentsChange([...selectedSegments, segmentId]);
    } else {
      toast.error(`You can select up to ${maxSelections} segments`);
    }
  };

  const removeSegment = (segmentId: string) => {
    onSegmentsChange(selectedSegments.filter(id => id !== segmentId));
  };

  const filteredSegments = segments.filter(segment =>
    segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    segment.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedSegmentDetails = segments.filter(segment => 
    selectedSegments.includes(segment.id)
  );

  const totalCustomers = selectedSegmentDetails.reduce(
    (sum, segment) => sum + segment.customer_count, 0
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Customer Segments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Customer Segments
          {selectedSegments.length > 0 && (
            <Badge variant="secondary">
              {selectedSegments.length} selected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search segments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Selected Segments Summary */}
        {selectedSegments.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Selected Segments</span>
              <Badge variant="default">
                {totalCustomers.toLocaleString()} total customers
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedSegmentDetails.map((segment) => (
                <Badge 
                  key={segment.id} 
                  variant="secondary" 
                  className="gap-1"
                >
                  {segment.name}
                  <span className="text-xs">({segment.customer_count})</span>
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
          </div>
        )}

        {/* Available Segments */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label>Available Segments</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateNew(!showCreateNew)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Create New
            </Button>
          </div>

          {/* Quick Create */}
          {showCreateNew && (
            <div className="border rounded-lg p-3 mb-3 bg-muted/30">
              <Label htmlFor="newSegmentName" className="text-sm">
                Quick Create Segment
              </Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="newSegmentName"
                  placeholder="Segment name..."
                  value={newSegmentName}
                  onChange={(e) => setNewSegmentName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && createQuickSegment()}
                />
                <Button onClick={createQuickSegment} disabled={!newSegmentName.trim()}>
                  Create
                </Button>
              </div>
            </div>
          )}

          {/* Segments List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredSegments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No segments found</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setShowCreateNew(true)}
                >
                  Create your first segment
                </Button>
              </div>
            ) : (
              filteredSegments.map((segment) => {
                const isSelected = selectedSegments.includes(segment.id);
                const canSelect = !isSelected && selectedSegments.length < maxSelections;
                
                return (
                  <div
                    key={segment.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-primary/10 border-primary' 
                        : canSelect 
                          ? 'hover:border-primary/50 hover:bg-muted/30' 
                          : 'opacity-50 cursor-not-allowed'
                    }`}
                    onClick={() => canSelect || isSelected ? toggleSegment(segment.id) : null}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{segment.name}</span>
                          {isSelected && (
                            <Badge variant="default" className="text-xs">
                              Selected
                            </Badge>
                          )}
                        </div>
                        {segment.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {segment.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {segment.customer_count.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          customers
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selection Limit Warning */}
        {selectedSegments.length >= maxSelections && (
          <div className="text-sm text-muted-foreground text-center p-2 bg-muted/30 rounded">
            Maximum of {maxSelections} segments can be selected
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MultiSegmentSelector;
