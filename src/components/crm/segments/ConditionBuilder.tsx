import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon,
  Users,
  Filter,
  ShoppingCart,
  TrendingUp,
  MessageSquare,
  Mail,
  Package,
  Hash,
  MousePointer,
  Eye,
  X
} from 'lucide-react';
import POSFilterGroup from './POSFilterGroup';
import EngagementFilterGroup from './EngagementFilterGroup';

interface SegmentCondition {
  field: string;
  operator: string;
  value: string | string[] | Date;
  logic?: 'AND' | 'OR';
}

interface ConditionBuilderProps {
  conditions: SegmentCondition[];
  availableTags: string[];
  onAddCondition: () => void;
  onUpdateCondition: (index: number, updates: Partial<SegmentCondition>) => void;
  onRemoveCondition: (index: number) => void;
}

const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  conditions,
  availableTags,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition
}) => {
  const addPOSCondition = () => {
    onUpdateCondition(conditions.length, { 
      field: 'product_purchased', 
      operator: 'contains', 
      value: '', 
      logic: 'AND' 
    });
    onAddCondition();
  };

  const addEngagementCondition = () => {
    onUpdateCondition(conditions.length, { 
      field: 'opened_last_campaign', 
      operator: 'equals', 
      value: 'true', 
      logic: 'AND' 
    });
    onAddCondition();
  };

  const isPOSField = (field: string) => {
    return ['product_purchased', 'product_category', 'purchase_count'].includes(field);
  };

  const isEngagementField = (field: string) => {
    return ['opened_last_campaign', 'clicked_last_3_campaigns', 'never_opened_campaign'].includes(field);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Segment Rules</Label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onAddCondition}>
            <Plus className="h-3 w-3 mr-1" />
            Basic Rule
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addPOSCondition}>
            <ShoppingCart className="h-3 w-3 mr-1" />
            POS Filter
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addEngagementCondition}>
            <Mail className="h-3 w-3 mr-1" />
            Engagement
          </Button>
        </div>
      </div>
      
      {conditions.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-muted-foreground/20 rounded-lg">
          <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No rules added yet</p>
          <p className="text-sm text-muted-foreground">Add rules to define your segment</p>
        </div>
      )}

      <div className="space-y-4">
        {conditions.map((condition, index) => (
          <div key={index} className="space-y-3">
            {index > 0 && (
              <div className="flex items-center gap-2">
                <NativeSelect
                  value={condition.logic}
                  onChange={(e) => onUpdateCondition(index, { logic: e.target.value as 'AND' | 'OR' })}
                  options={[
                    { value: 'AND', label: 'AND' },
                    { value: 'OR', label: 'OR' }
                  ]}
                  className="w-20"
                />
              </div>
            )}

            {/* POS Filter Group */}
            {isPOSField(condition.field) && (
              <POSFilterGroup
                condition={condition}
                index={index}
                onUpdate={onUpdateCondition}
              />
            )}

            {/* Engagement Filter Group */}
            {isEngagementField(condition.field) && (
              <EngagementFilterGroup
                condition={condition}
                index={index}
                onUpdate={onUpdateCondition}
              />
            )}

            {/* Basic Filter Group */}
            {!isPOSField(condition.field) && !isEngagementField(condition.field) && (
              <Card className="border">
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Field</Label>
                      <NativeSelect
                        value={condition.field}
                        onChange={(e) => onUpdateCondition(index, { field: e.target.value, value: '' })}
                        options={[
                          { value: 'persona', label: 'Persona' },
                          { value: 'tags', label: 'Customer Tags' },
                          { value: 'created_at', label: 'Joined Date' },
                          { value: 'last_purchase_date', label: 'Last Purchase' },
                          { value: 'lifetime_value', label: 'Lifetime Value' },
                          { value: 'sms_opt_in', label: 'SMS Opt-In' },
                          { value: 'email', label: 'Email Contains' }
                        ]}
                      />
                    </div>
                    
                    <div>
                      <Label className="text-xs">Operator</Label>
                      <NativeSelect
                        value={condition.operator}
                        onChange={(e) => onUpdateCondition(index, { operator: e.target.value })}
                        options={(() => {
                          const baseOptions = [];
                          if (condition.field === 'persona') baseOptions.push({ value: 'equals', label: 'is' });
                          if (condition.field === 'tags') baseOptions.push({ value: 'includes', label: 'includes' });
                          if (condition.field === 'sms_opt_in') baseOptions.push({ value: 'equals', label: 'is' });
                          if (condition.field === 'created_at' || condition.field === 'last_purchase_date') {
                            baseOptions.push({ value: 'after', label: 'after' });
                            baseOptions.push({ value: 'before', label: 'before' });
                          }
                          if (condition.field === 'lifetime_value') {
                            baseOptions.push({ value: 'greater_than', label: 'greater than' });
                            baseOptions.push({ value: 'less_than', label: 'less than' });
                            baseOptions.push({ value: 'equals', label: 'equals' });
                          }
                          if (condition.field === 'email') baseOptions.push({ value: 'contains', label: 'contains' });
                          return baseOptions;
                        })()}
                      />
                    </div>
                    
                    <div>
                      <Label className="text-xs">Value</Label>
                      {condition.field === 'persona' && (
                        <NativeSelect
                          value={condition.value as string}
                          onChange={(e) => onUpdateCondition(index, { value: e.target.value })}
                          placeholder="Select persona"
                          options={[
                            { value: 'Newbie', label: '🌱 Newbie' },
                            { value: 'Struggler', label: '😅 Plant Killer' },
                            { value: 'Regular', label: '🌿 Regular' },
                            { value: 'Expert', label: '🌺 Expert' }
                          ]}
                        />
                      )}
                      
                      {condition.field === 'sms_opt_in' && (
                        <NativeSelect
                          value={condition.value as string}
                          onChange={(e) => onUpdateCondition(index, { value: e.target.value })}
                          placeholder="Select option"
                          options={[
                            { value: 'true', label: '✅ Yes' },
                            { value: 'false', label: '❌ No' }
                          ]}
                        />
                      )}
                      
                      {condition.field === 'tags' && (
                        <NativeSelect
                          value={condition.value as string}
                          onChange={(e) => onUpdateCondition(index, { value: e.target.value })}
                          placeholder="Select tag"
                          options={availableTags.map(tag => ({
                            value: tag,
                            label: tag
                          }))}
                        />
                      )}

                      {(condition.field === 'created_at' || condition.field === 'last_purchase_date') && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !condition.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {condition.value instanceof Date ? (
                                format(condition.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={condition.value instanceof Date ? condition.value : undefined}
                              onSelect={(date) => onUpdateCondition(index, { value: date || new Date() })}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      )}

                      {(condition.field === 'lifetime_value' || condition.field === 'email') && (
                        <Input
                          value={condition.value as string}
                          onChange={(e) => onUpdateCondition(index, { value: e.target.value })}
                          placeholder={condition.field === 'lifetime_value' ? "$0.00" : "Text to search"}
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemoveCondition(index)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Remove Rule
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConditionBuilder;