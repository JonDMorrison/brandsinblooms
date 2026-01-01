import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { triggerCatalog } from '@/lib/automation/triggerCatalog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface TriggerNodeData {
  triggerType: string;
  label: string;
  conditions?: Record<string, any>;
}

interface TriggerNodeEditorProps {
  data: TriggerNodeData;
  onSave: (data: TriggerNodeData) => void;
  onCancel: () => void;
}

export const TriggerNodeEditor: React.FC<TriggerNodeEditorProps> = ({
  data,
  onSave,
  onCancel
}) => {
  const [triggerType, setTriggerType] = useState(data.triggerType || 'loyalty_join');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>(data.conditions?.segment_id || '');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(data.conditions?.persona_id || '');

  // Fetch segments when segment trigger is selected
  const { data: segments, isLoading: loadingSegments } = useQuery({
    queryKey: ['segments-for-trigger'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_segments')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: triggerType === 'segment.added',
  });

  // Fetch personas when persona trigger is selected
  const { data: personas, isLoading: loadingPersonas } = useQuery({
    queryKey: ['personas-for-trigger'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personas')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: triggerType === 'persona.assigned',
  });

  useEffect(() => {
    setTriggerType(data.triggerType || 'loyalty_join');
    setSelectedSegmentId(data.conditions?.segment_id || '');
    setSelectedPersonaId(data.conditions?.persona_id || '');
  }, [data.triggerType, data.conditions]);

  const handleSave = () => {
    const selectedTrigger = triggerCatalog.find(t => t.id === triggerType);
    
    // Build conditions based on trigger type
    const conditions: Record<string, any> = { ...data.conditions };
    
    if (triggerType === 'segment.added' && selectedSegmentId) {
      conditions.segment_id = selectedSegmentId;
      conditions.segment_name = segments?.find(s => s.id === selectedSegmentId)?.name;
    } else if (triggerType === 'persona.assigned' && selectedPersonaId) {
      conditions.persona_id = selectedPersonaId;
      conditions.persona_name = personas?.find(p => p.id === selectedPersonaId)?.name;
    }
    
    onSave({
      triggerType,
      label: selectedTrigger?.label || 'Trigger',
      conditions
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  const selectedTrigger = triggerCatalog.find(t => t.id === triggerType);
  
  // Determine if save should be disabled
  const isSaveDisabled = 
    (triggerType === 'segment.added' && !selectedSegmentId) ||
    (triggerType === 'persona.assigned' && !selectedPersonaId);

  return (
    <Card className="w-full max-w-md" onKeyDown={handleKeyDown}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          ⚡ Edit Trigger Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="trigger-type">Trigger Type *</Label>
          <NativeSelect
            id="trigger-type"
            value={triggerType}
            onChange={(e) => {
              setTriggerType(e.target.value);
              // Reset selections when trigger type changes
              setSelectedSegmentId('');
              setSelectedPersonaId('');
            }}
            autoFocus
          >
            {triggerCatalog.map((trigger) => (
              <option key={trigger.id} value={trigger.id}>
                {trigger.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* Segment selector for segment.added trigger */}
        {triggerType === 'segment.added' && (
          <div className="space-y-2">
            <Label htmlFor="segment-select">Select Segment *</Label>
            {loadingSegments ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading segments...
              </div>
            ) : segments && segments.length > 0 ? (
              <NativeSelect
                id="segment-select"
                value={selectedSegmentId}
                onChange={(e) => setSelectedSegmentId(e.target.value)}
              >
                <option value="">Choose a segment...</option>
                {segments.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                No segments found. Create segments in the CRM first.
              </p>
            )}
          </div>
        )}

        {/* Persona selector for persona.assigned trigger */}
        {triggerType === 'persona.assigned' && (
          <div className="space-y-2">
            <Label htmlFor="persona-select">Select Persona *</Label>
            {loadingPersonas ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading personas...
              </div>
            ) : personas && personas.length > 0 ? (
              <NativeSelect
                id="persona-select"
                value={selectedPersonaId}
                onChange={(e) => setSelectedPersonaId(e.target.value)}
              >
                <option value="">Choose a persona...</option>
                {personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.name}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                No personas found. Create personas in the CRM first.
              </p>
            )}
          </div>
        )}

        {selectedTrigger && (
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm font-medium text-foreground mb-1">
              {selectedTrigger.label}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedTrigger.description}
            </p>
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
          <p className="text-xs text-blue-600 dark:text-blue-400">
            💡 <strong>Tip:</strong> This trigger will start the automation when the selected event occurs. 
            {triggerType === 'segment.added' && ' Select which segment should trigger this automation.'}
            {triggerType === 'persona.assigned' && ' Select which persona assignment should trigger this automation.'}
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaveDisabled}>
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
