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
        <Label htmlFor="segmentName">Segment Name</Label>
        <Input
          id="segmentName"
          value={segmentName}
          onChange={(e) => setSegmentName(e.target.value)}
          placeholder="e.g., High-Value Spring Shoppers"
          className="mt-1"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Filter Criteria</Label>
          <Select onValueChange={addFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Add filter..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lastPurchase">📆 Last Purchase Date</SelectItem>
              <SelectItem value="purchaseCount">🛒 Number of Purchases</SelectItem>
              <SelectItem value="totalSpend">💰 Total Spend</SelectItem>
              <SelectItem value="tags">🏷️ Tags</SelectItem>
              <SelectItem value="productCategory">🪴 Product Category</SelectItem>
              <SelectItem value="emailEngagement">💌 Email Engagement</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filters.map((filter, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                {getFilterLabel(filter.type)}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFilter(index)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderFilterConfig(filter, index)}
            </CardContent>
          </Card>
        ))}

        {filters.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Add filter criteria to define your custom segment
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <Button onClick={handleSave} disabled={!segmentName.trim() || filters.length === 0}>
          Save Segment
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};