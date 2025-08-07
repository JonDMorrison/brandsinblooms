import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';

interface DelayNodeData {
  delayValue: number;
  delayUnit: 'minutes' | 'hours' | 'days';
}

interface DelayNodeEditorProps {
  data: DelayNodeData;
  onSave: (data: DelayNodeData) => void;
  onCancel: () => void;
}

const delayUnits = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' }
];

export const DelayNodeEditor: React.FC<DelayNodeEditorProps> = ({
  data,
  onSave,
  onCancel
}) => {
  const [delayValue, setDelayValue] = useState(data.delayValue || 1);
  const [delayUnit, setDelayUnit] = useState<'minutes' | 'hours' | 'days'>(data.delayUnit || 'hours');
  const [error, setError] = useState('');

  useEffect(() => {
    setDelayValue(data.delayValue || 1);
    setDelayUnit(data.delayUnit || 'hours');
  }, [data]);

  const validateAndSave = () => {
    if (delayValue <= 0) {
      setError('Delay value must be greater than 0');
      return;
    }

    if (delayValue > 365 && delayUnit === 'days') {
      setError('Maximum delay is 365 days');
      return;
    }

    if (delayValue > 8760 && delayUnit === 'hours') {
      setError('Maximum delay is 8760 hours (1 year)');
      return;
    }

    if (delayValue > 525600 && delayUnit === 'minutes') {
      setError('Maximum delay is 525600 minutes (1 year)');
      return;
    }

    setError('');
    onSave({ delayValue, delayUnit });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter') {
      validateAndSave();
    }
  };

  const getDelayPreview = () => {
    if (delayValue === 1) {
      return `Wait 1 ${delayUnit.slice(0, -1)}`;
    }
    return `Wait ${delayValue} ${delayUnit}`;
  };

  return (
    <Card className="w-full max-w-md" onKeyDown={handleKeyDown}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          ⏱️ Edit Delay Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="delay-value">Delay Duration *</Label>
          <div className="flex gap-2">
            <Input
              id="delay-value"
              type="number"
              min="1"
              value={delayValue}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 1;
                setDelayValue(value);
                setError('');
              }}
              className="flex-1"
              autoFocus
            />
            <NativeSelect
              value={delayUnit}
              onChange={(e) => setDelayUnit(e.target.value as 'minutes' | 'hours' | 'days')}
              className="min-w-[100px]"
            >
              {delayUnits.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm font-medium text-foreground">
            Preview: {getDelayPreview()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Customers will wait this duration before proceeding to the next step.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={validateAndSave} disabled={!!error}>
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};