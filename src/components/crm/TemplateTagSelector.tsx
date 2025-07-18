import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Plus, Tag } from 'lucide-react';

interface TemplateTagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  disabled?: boolean;
}

const predefinedTags = [
  'Holiday',
  'Promotion', 
  'Welcome Series',
  'Seasonal',
  'Houseplants',
  'Succulents',
  'Events',
  'Newsletter',
  'Product Launch',
  'Sale',
  'Educational',
  'Care Tips',
  'New Arrivals'
];

export const TemplateTagSelector: React.FC<TemplateTagSelectorProps> = ({
  selectedTags,
  onTagsChange,
  disabled = false
}) => {
  const [newTag, setNewTag] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const handleRemoveTag = (tag: string) => {
    onTagsChange(selectedTags.filter(t => t !== tag));
  };

  const handleAddCustomTag = () => {
    const tag = newTag.trim();
    if (tag && !selectedTags.includes(tag)) {
      onTagsChange([...selectedTags, tag]);
      setNewTag('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustomTag();
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Tags</Label>
      
      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map(tag => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              {!disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 hover:bg-transparent"
                  onClick={() => handleRemoveTag(tag)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Tag Selector */}
      {!disabled && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Tag className="h-4 w-4" />
              Add Tags
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="start">
            <div className="space-y-4">
              {/* Custom Tag Input */}
              <div className="space-y-2">
                <Label className="text-sm">Add Custom Tag</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter tag name..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="flex-1"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleAddCustomTag}
                    disabled={!newTag.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Predefined Tags */}
              <div className="space-y-2">
                <Label className="text-sm">Common Tags</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {predefinedTags.map(tag => (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox
                        id={tag}
                        checked={selectedTags.includes(tag)}
                        onCheckedChange={() => handleTagToggle(tag)}
                      />
                      <label 
                        htmlFor={tag}
                        className="text-sm cursor-pointer flex-1 truncate"
                      >
                        {tag}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {selectedTags.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add tags to help organize and find your templates
        </p>
      )}
    </div>
  );
};