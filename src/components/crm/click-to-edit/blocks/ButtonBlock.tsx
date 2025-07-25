import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ButtonBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview: boolean;
}

export const ButtonBlock: React.FC<ButtonBlockProps> = ({ block, onUpdate, isPreview }) => {
  const buttonText = block.buttonText || 'Click Here';
  const buttonUrl = block.buttonUrl || '#';
  const alignment = block.textAlign || 'center';
  const buttonColor = block.buttonColor || '#000000';
  const buttonSize = block.buttonSize || 'medium';
  const isRounded = block.isRounded !== false;

  if (isPreview) {
    const paddingClass = {
      none: 'p-0',
      small: 'p-4',
      medium: 'p-6',
      large: 'p-8'
    }[block.padding || 'medium'];

    const sizeClass = {
      small: 'px-4 py-2 text-sm',
      medium: 'px-6 py-3 text-base',
      large: 'px-8 py-4 text-lg'
    }[buttonSize];

    return (
      <div className={cn(
        paddingClass,
        alignment === 'center' && "text-center",
        alignment === 'right' && "text-right"
      )}>
        <Button
          asChild
          className={cn(
            sizeClass,
            isRounded ? 'rounded-full' : 'rounded-md'
          )}
          style={{ 
            backgroundColor: buttonColor,
            color: '#ffffff'
          }}
        >
          <a href={buttonUrl} target="_blank" rel="noopener noreferrer">
            {buttonText}
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="buttonText">Button Text</Label>
          <Input
            id="buttonText"
            value={buttonText}
            onChange={(e) => onUpdate({ buttonText: e.target.value })}
            placeholder="Enter button text"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="buttonUrl">Link URL</Label>
          <Input
            id="buttonUrl"
            value={buttonUrl}
            onChange={(e) => onUpdate({ buttonUrl: e.target.value })}
            placeholder="https://example.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Alignment</Label>
          <Select
            value={alignment}
            onValueChange={(value) => onUpdate({ textAlign: value as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="buttonColor">Button Color</Label>
          <Input
            id="buttonColor"
            type="color"
            value={buttonColor}
            onChange={(e) => onUpdate({ buttonColor: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Size</Label>
          <Select
            value={buttonSize}
            onValueChange={(value) => onUpdate({ buttonSize: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            checked={isRounded}
            onCheckedChange={(checked) => onUpdate({ isRounded: checked })}
          />
          <Label>Rounded corners</Label>
        </div>

        <div className="space-y-2">
          <Label>Padding</Label>
          <Select
            value={block.padding || 'medium'}
            onValueChange={(value) => onUpdate({ padding: value as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};