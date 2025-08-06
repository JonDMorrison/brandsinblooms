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
            <Select
              value={condition.field}
              onValueChange={(value) => onUpdate(index, { field: value, value: 'true' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="opened_last_campaign">
                  <div className="flex items-center gap-2">
                    <Eye className="h-3 w-3" />
                    Opened Last Campaign
                  </div>
                </SelectItem>
                <SelectItem value="clicked_last_3_campaigns">
                  <div className="flex items-center gap-2">
                    <MousePointer className="h-3 w-3" />
                    Clicked Last 3 Campaigns
                  </div>
                </SelectItem>
                <SelectItem value="never_opened_campaign">
                  <div className="flex items-center gap-2">
                    <X className="h-3 w-3" />
                    Never Opened Any Campaign
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-xs">Value</Label>
            <Select
              value={condition.value as string}
              onValueChange={(value) => onUpdate(index, { value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
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