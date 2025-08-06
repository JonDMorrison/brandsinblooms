import React from 'react';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Package, Hash } from 'lucide-react';

interface SegmentCondition {
  field: string;
  operator: string;
  value: string | string[] | Date;
  logic?: 'AND' | 'OR';
}

interface POSFilterGroupProps {
  condition: SegmentCondition;
  index: number;
  onUpdate: (index: number, updates: Partial<SegmentCondition>) => void;
}

const POSFilterGroup: React.FC<POSFilterGroupProps> = ({ condition, index, onUpdate }) => {
  const productCategories = [
    'Trees & Shrubs',
    'Perennials',
    'Annuals',
    'Houseplants',
    'Garden Tools',
    'Fertilizers & Soil',
    'Pots & Planters',
    'Seeds & Bulbs',
    'Watering Supplies',
    'Pest Control'
  ];

  return (
    <Card className="border-garden-green/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-garden-green" />
          POS-Based Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Filter Type</Label>
            <NativeSelect
              value={condition.field}
              onChange={(e) => onUpdate(index, { field: e.target.value, value: '' })}
              options={[
                { value: 'product_purchased', label: '📦 Product Purchased' },
                { value: 'product_category', label: '🛒 Product Category' },
                { value: 'purchase_count', label: '#️⃣ Purchase Count' }
              ]}
            />
          </div>
          
          <div>
            <Label className="text-xs">Operator</Label>
            <NativeSelect
              value={condition.operator}
              onChange={(e) => onUpdate(index, { operator: e.target.value })}
              options={(() => {
                const options = [];
                if (condition.field === 'product_purchased') options.push({ value: 'contains', label: 'contains' });
                if (condition.field === 'product_category') options.push({ value: 'equals', label: 'is' });
                if (condition.field === 'purchase_count') {
                  options.push(
                    { value: 'greater_than', label: 'greater than' },
                    { value: 'less_than', label: 'less than' },
                    { value: 'equals', label: 'equals' }
                  );
                }
                return options;
              })()}
            />
          </div>
          
          <div>
            <Label className="text-xs">Value</Label>
            {condition.field === 'product_purchased' && (
              <Input
                value={condition.value as string}
                onChange={(e) => onUpdate(index, { value: e.target.value })}
                placeholder="e.g., roses, tomato"
              />
            )}
            
            {condition.field === 'product_category' && (
              <NativeSelect
                value={condition.value as string}
                onChange={(e) => onUpdate(index, { value: e.target.value })}
                placeholder="Select category"
                options={productCategories.map(category => ({
                  value: category,
                  label: category
                }))}
              />
            )}
            
            {condition.field === 'purchase_count' && (
              <Input
                type="number"
                value={condition.value as string}
                onChange={(e) => onUpdate(index, { value: e.target.value })}
                placeholder="Number"
                min="0"
              />
            )}
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground p-2 bg-amber-50 border border-amber-200 rounded">
          <strong>Note:</strong> POS filters require product data sync from your point-of-sale system (Shopify, Square, etc.)
        </div>
      </CardContent>
    </Card>
  );
};

export default POSFilterGroup;