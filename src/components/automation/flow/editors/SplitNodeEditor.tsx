import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface SplitNodeData {
  splitType: 'conditional' | 'ab_test' | 'random';
  conditions?: any[];
  percentage?: number;
  description?: string;
}

interface SplitNodeEditorProps {
  data: SplitNodeData;
  onSave: (data: SplitNodeData) => void;
  onCancel: () => void;
}

const splitTypes = [
  { 
    value: 'conditional', 
    label: 'Conditional Split',
    description: 'Split based on customer conditions or behavior'
  },
  { 
    value: 'ab_test', 
    label: 'A/B Test Split',
    description: 'Test different paths with percentage distribution'
  },
  { 
    value: 'random', 
    label: 'Random Split',
    description: 'Randomly distribute customers between paths'
  }
];

export const SplitNodeEditor: React.FC<SplitNodeEditorProps> = ({
  data,
  onSave,
  onCancel
}) => {
  const [splitType, setSplitType] = useState<'conditional' | 'ab_test' | 'random'>(
    data.splitType || 'conditional'
  );
  const [percentage, setPercentage] = useState(data.percentage || 50);
  const [description, setDescription] = useState(data.description || '');

  useEffect(() => {
    setSplitType(data.splitType || 'conditional');
    setPercentage(data.percentage || 50);
    setDescription(data.description || '');
  }, [data]);

  const handleSave = () => {
    const splitData: SplitNodeData = {
      splitType,
      conditions: data.conditions || [],
      description
    };

    if (splitType === 'ab_test' || splitType === 'random') {
      splitData.percentage = percentage;
    }

    onSave(splitData);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
  };

  const selectedSplit = splitTypes.find(s => s.value === splitType);

  return (
    <Card className="w-full max-w-lg" onKeyDown={handleKeyDown}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔀 Edit Split Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="split-type">Split Type *</Label>
          <NativeSelect
            id="split-type"
            value={splitType}
            onChange={(e) => setSplitType(e.target.value as 'conditional' | 'ab_test' | 'random')}
            autoFocus
          >
            {splitTypes.map((split) => (
              <option key={split.value} value={split.value}>
                {split.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        {selectedSplit && (
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm font-medium text-foreground mb-1">
              {selectedSplit.label}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedSplit.description}
            </p>
          </div>
        )}

        {(splitType === 'ab_test' || splitType === 'random') && (
          <div className="space-y-2">
            <Label htmlFor="percentage">Split Percentage</Label>
            <div className="flex items-center gap-2">
              <Input
                id="percentage"
                type="number"
                min="1"
                max="99"
                value={percentage}
                onChange={(e) => setPercentage(parseInt(e.target.value) || 50)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">
                % go to Path A, {100 - percentage}% go to Path B
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            placeholder="Describe the purpose of this split..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[80px]"
          />
        </div>

        {splitType === 'conditional' && (
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              💡 <strong>Note:</strong> Conditional logic setup will be available in advanced mode. 
              For now, this creates a basic split node.
            </p>
          </div>
        )}

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