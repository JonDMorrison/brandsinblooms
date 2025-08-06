import React from 'react';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, MousePointer, X, Eye } from 'lucide-react';

interface SegmentCondition {
  field: string;
  operator: string;
  value: string | string[] | Date;
  logic?: 'AND' | 'OR';
}

interface EngagementFilterGroupProps {
  condition: SegmentCondition;
  index: number;
  onUpdate: (index: number, updates: Partial<SegmentCondition>) => void;
}

const EngagementFilterGroup: React.FC<EngagementFilterGroupProps> = ({ condition, index, onUpdate }) => {
  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Mail className="h-4 w-4 text-blue-600" />
          Email Engagement Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Engagement Type</Label>
            <NativeSelect
              value={condition.field}
              onChange={(e) => onUpdate(index, { field: e.target.value, value: 'true' })}
              options={[
                { value: 'opened_last_campaign', label: '👀 Opened Last Campaign' },
                { value: 'clicked_last_3_campaigns', label: '🖱️ Clicked Last 3 Campaigns' },
                { value: 'never_opened_campaign', label: '❌ Never Opened Any Campaign' }
              ]}
            />
          </div>
          
          <div>
            <Label className="text-xs">Value</Label>
            <NativeSelect
              value={condition.value as string}
              onChange={(e) => onUpdate(index, { value: e.target.value })}
              options={[
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' }
              ]}
            />
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground p-2 bg-blue-50 border border-blue-200 rounded">
          <strong>Note:</strong> Engagement filters are based on your email campaign history and open/click tracking data.
        </div>
      </CardContent>
    </Card>
  );
};

export default EngagementFilterGroup;