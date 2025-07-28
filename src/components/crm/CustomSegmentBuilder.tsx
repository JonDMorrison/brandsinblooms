import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";

interface FilterCriteria {
  type: string;
  operator?: string;
  value?: string | number;
  values?: string[];
  days?: number;
}

interface CustomSegmentBuilderProps {
  onSave: (segmentData: { name: string; filters: FilterCriteria[] }) => void;
  onCancel: () => void;
  open?: boolean;
}

const PRODUCT_CATEGORIES = [
  "Houseplants", "Vegetables", "Herbs", "Flowers", "Trees & Shrubs", 
  "Garden Tools", "Fertilizers", "Pots & Planters", "Holiday Décor", "Seeds"
];

const CUSTOMER_TAGS = [
  "VIP", "Workshop Attendee", "Loyalty Member", "Newsletter Subscriber", 
  "Early Bird", "Bulk Buyer", "Seasonal Shopper", "First-Time Buyer"
];

export const CustomSegmentBuilder = ({ onSave, onCancel }: CustomSegmentBuilderProps) => {
  const [segmentName, setSegmentName] = useState("");
  const [filters, setFilters] = useState<FilterCriteria[]>([]);

  const addFilter = (type: string) => {
    const newFilter: FilterCriteria = { type };
    setFilters([...filters, newFilter]);
  };

  const updateFilter = (index: number, updates: Partial<FilterCriteria>) => {
    const updated = filters.map((filter, i) => 
      i === index ? { ...filter, ...updates } : filter
    );
    setFilters(updated);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!segmentName.trim()) return;
    onSave({ name: segmentName, filters });
  };

  const renderFilterConfig = (filter: FilterCriteria, index: number) => {
    switch (filter.type) {
      case "lastPurchase":
        return (
          <div className="flex gap-2 items-center">
            <Select value={filter.operator} onValueChange={(value) => updateFilter(index, { operator: value })}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="within">Within</SelectItem>
                <SelectItem value="before">Before</SelectItem>
                <SelectItem value="never">Never purchased</SelectItem>
              </SelectContent>
            </Select>
            {filter.operator !== "never" && (
              <Input
                type="number"
                placeholder="Days"
                className="w-20"
                value={filter.days || ""}
                onChange={(e) => updateFilter(index, { days: parseInt(e.target.value) })}
              />
            )}
          </div>
        );

      case "purchaseCount":
        return (
          <div className="flex gap-2 items-center">
            <Select value={filter.operator} onValueChange={(value) => updateFilter(index, { operator: value })}>
              <SelectTrigger className="w-20">
                <SelectValue placeholder="≥" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gte">≥</SelectItem>
                <SelectItem value="eq">=</SelectItem>
                <SelectItem value="lte">≤</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Number"
              className="w-24"
              value={filter.value || ""}
              onChange={(e) => updateFilter(index, { value: parseInt(e.target.value) })}
            />
          </div>
        );

      case "totalSpend":
        return (
          <div className="flex gap-2 items-center">
            <Select value={filter.operator} onValueChange={(value) => updateFilter(index, { operator: value })}>
              <SelectTrigger className="w-20">
                <SelectValue placeholder="≥" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gte">≥</SelectItem>
                <SelectItem value="eq">=</SelectItem>
                <SelectItem value="lte">≤</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Amount"
              className="w-32"
              value={filter.value || ""}
              onChange={(e) => updateFilter(index, { value: parseFloat(e.target.value) })}
            />
          </div>
        );

      case "tags":
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {(filter.values || []).map((tag, tagIndex) => (
                <Badge key={tagIndex} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => {
                      const newValues = (filter.values || []).filter((_, i) => i !== tagIndex);
                      updateFilter(index, { values: newValues });
                    }}
                  />
                </Badge>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CUSTOMER_TAGS.filter(tag => !filter.values?.includes(tag)).map((tag) => (
                <div key={tag} className="flex items-center space-x-2">
                  <Checkbox
                    id={`tag-${tag}`}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const newValues = [...(filter.values || []), tag];
                        updateFilter(index, { values: newValues });
                      }
                    }}
                  />
                  <Label htmlFor={`tag-${tag}`} className="text-sm">{tag}</Label>
                </div>
              ))}
            </div>
          </div>
        );

      case "productCategory":
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {(filter.values || []).map((category, catIndex) => (
                <Badge key={catIndex} variant="secondary" className="flex items-center gap-1">
                  {category}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => {
                      const newValues = (filter.values || []).filter((_, i) => i !== catIndex);
                      updateFilter(index, { values: newValues });
                    }}
                  />
                </Badge>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRODUCT_CATEGORIES.filter(cat => !filter.values?.includes(cat)).map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cat-${category}`}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const newValues = [...(filter.values || []), category];
                        updateFilter(index, { values: newValues });
                      }
                    }}
                  />
                  <Label htmlFor={`cat-${category}`} className="text-sm">{category}</Label>
                </div>
              ))}
            </div>
          </div>
        );

      case "emailEngagement":
        return (
          <div className="flex gap-2 items-center">
            <Select value={filter.operator} onValueChange={(value) => updateFilter(index, { operator: value })}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="opened">Opened</SelectItem>
                <SelectItem value="clicked">Clicked</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Campaigns"
              className="w-24"
              value={filter.value || ""}
              onChange={(e) => updateFilter(index, { value: parseInt(e.target.value) })}
            />
            <span className="text-sm text-muted-foreground">campaigns in past</span>
            <Input
              type="number"
              placeholder="Days"
              className="w-20"
              value={filter.days || ""}
              onChange={(e) => updateFilter(index, { days: parseInt(e.target.value) })}
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        );

      default:
        return null;
    }
  };

  const getFilterLabel = (type: string) => {
    const labels = {
      lastPurchase: "📆 Last Purchase Date",
      purchaseCount: "🛒 Number of Purchases", 
      totalSpend: "💰 Total Spend",
      tags: "🏷️ Tags",
      productCategory: "🪴 Product Category",
      emailEngagement: "💌 Email Engagement"
    };
    return labels[type as keyof typeof labels] || type;
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="segmentName" className="block text-sm font-medium text-foreground mb-2">
          Segment Name
        </label>
        <input
          id="segmentName"
          type="text"
          value={segmentName}
          onChange={(e) => setSegmentName(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Enter segment name..."
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-foreground">Filters</h3>
          <select
            onChange={(e) => {
              if (e.target.value) {
                addFilter(e.target.value);
                e.target.value = '';
              }
            }}
            className="px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Add Filter</option>
            <option value="lastPurchase">Last Purchase</option>
            <option value="purchaseCount">Purchase Count</option>
            <option value="totalSpent">Total Spent</option>
            <option value="tags">Tags</option>
            <option value="productCategory">Product Category</option>
            <option value="emailEngagement">Email Engagement</option>
          </select>
        </div>

        <div className="space-y-4">
          {filters.map((filter, index) => (
            <div key={index} className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-foreground">{getFilterLabel(filter.type)}</h4>
                <button
                  onClick={() => removeFilter(index)}
                  className="text-destructive hover:text-destructive/80 text-sm"
                >
                  Remove
                </button>
              </div>
              {renderFilterConfig(filter, index)}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-border">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-accent"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!segmentName.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Segment
        </button>
      </div>
    </div>
  );
};