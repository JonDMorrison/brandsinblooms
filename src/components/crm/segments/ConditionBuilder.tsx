import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
                <Select
                  value={condition.logic}
                  onValueChange={(value) => onUpdateCondition(index, { logic: value as 'AND' | 'OR' })}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">AND</SelectItem>
                    <SelectItem value="OR">OR</SelectItem>
                  </SelectContent>
                </Select>
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
                      <Select
                        value={condition.field}
                        onValueChange={(value) => onUpdateCondition(index, { field: value, value: '' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="persona">
                            <div className="flex items-center gap-2">
                              <Users className="h-3 w-3" />
                              Persona
                            </div>
                          </SelectItem>
                          <SelectItem value="tags">
                            <div className="flex items-center gap-2">
                              <Filter className="h-3 w-3" />
                              Customer Tags
                            </div>
                          </SelectItem>
                          <SelectItem value="created_at">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-3 w-3" />
                              Joined Date
                            </div>
                          </SelectItem>
                          <SelectItem value="last_purchase_date">
                            <div className="flex items-center gap-2">
                              <ShoppingCart className="h-3 w-3" />
                              Last Purchase
                            </div>
                          </SelectItem>
                          <SelectItem value="lifetime_value">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-3 w-3" />
                              Lifetime Value
                            </div>
                          </SelectItem>
                          <SelectItem value="sms_opt_in">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-3 w-3" />
                              SMS Opt-In
                            </div>
                          </SelectItem>
                          <SelectItem value="email">
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3" />
                              Email Contains
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="text-xs">Operator</Label>
                      <Select
                        value={condition.operator}
                        onValueChange={(value) => onUpdateCondition(index, { operator: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {condition.field === 'persona' && (
                            <SelectItem value="equals">is</SelectItem>
                          )}
                          {condition.field === 'tags' && (
                            <SelectItem value="includes">includes</SelectItem>
                          )}
                          {condition.field === 'sms_opt_in' && (
                            <SelectItem value="equals">is</SelectItem>
                          )}
                          {(condition.field === 'created_at' || condition.field === 'last_purchase_date') && (
                            <>
                              <SelectItem value="after">after</SelectItem>
                              <SelectItem value="before">before</SelectItem>
                            </>
                          )}
                          {condition.field === 'lifetime_value' && (
                            <>
                              <SelectItem value="greater_than">greater than</SelectItem>
                              <SelectItem value="less_than">less than</SelectItem>
                              <SelectItem value="equals">equals</SelectItem>
                            </>
                          )}
                          {condition.field === 'email' && (
                            <SelectItem value="contains">contains</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="text-xs">Value</Label>
                      {condition.field === 'persona' && (
                        <Select
                          value={condition.value as string}
                          onValueChange={(value) => onUpdateCondition(index, { value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select persona" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Newbie">🌱 Newbie</SelectItem>
                            <SelectItem value="Struggler">😅 Plant Killer</SelectItem>
                            <SelectItem value="Regular">🌿 Regular</SelectItem>
                            <SelectItem value="Expert">🌺 Expert</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      
                      {condition.field === 'sms_opt_in' && (
                        <Select
                          value={condition.value as string}
                          onValueChange={(value) => onUpdateCondition(index, { value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">✅ Yes</SelectItem>
                            <SelectItem value="false">❌ No</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      
                      {condition.field === 'tags' && (
                        <Select
                          value={condition.value as string}
                          onValueChange={(value) => onUpdateCondition(index, { value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select tag" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTags.map(tag => (
                              <SelectItem key={tag} value={tag}>
                                <Badge variant="secondary" className="text-xs">{tag}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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