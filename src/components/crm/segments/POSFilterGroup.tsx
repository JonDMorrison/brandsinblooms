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
            <Select
              value={condition.field}
              onValueChange={(value) => onUpdate(index, { field: value, value: '' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product_purchased">
                  <div className="flex items-center gap-2">
                    <Package className="h-3 w-3" />
                    Product Purchased
                  </div>
                </SelectItem>
                <SelectItem value="product_category">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-3 w-3" />
                    Product Category
                  </div>
                </SelectItem>
                <SelectItem value="purchase_count">
                  <div className="flex items-center gap-2">
                    <Hash className="h-3 w-3" />
                    Purchase Count
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="text-xs">Operator</Label>
            <Select
              value={condition.operator}
              onValueChange={(value) => onUpdate(index, { operator: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {condition.field === 'product_purchased' && (
                  <SelectItem value="contains">contains</SelectItem>
                )}
                {condition.field === 'product_category' && (
                  <SelectItem value="equals">is</SelectItem>
                )}
                {condition.field === 'purchase_count' && (
                  <>
                    <SelectItem value="greater_than">greater than</SelectItem>
                    <SelectItem value="less_than">less than</SelectItem>
                    <SelectItem value="equals">equals</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
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
              <Select
                value={condition.value as string}
                onValueChange={(value) => onUpdate(index, { value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {productCategories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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