import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { triggerCatalog } from '@/lib/automation/triggerCatalog';

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

  useEffect(() => {
    setTriggerType(data.triggerType || 'loyalty_join');
  }, [data.triggerType]);

  const handleSave = () => {
    const selectedTrigger = triggerCatalog.find(t => t.id === triggerType);
    onSave({
      triggerType,
      label: selectedTrigger?.label || 'Trigger',
      conditions: data.conditions || {}
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter') {
      handleSave();
    }
  };

  const selectedTrigger = triggerCatalog.find(t => t.id === triggerType);

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
            onChange={(e) => setTriggerType(e.target.value)}
            autoFocus
          >
            {triggerCatalog.map((trigger) => (
              <option key={trigger.id} value={trigger.id}>
                {trigger.label}
              </option>
            ))}
          </NativeSelect>
        </div>

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
            Choose the trigger that best matches your campaign goals.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};