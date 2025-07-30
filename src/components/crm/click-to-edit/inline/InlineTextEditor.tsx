import React, { useState, useRef, useEffect } from 'react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface InlineTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}

export const InlineTextEditor: React.FC<InlineTextEditorProps> = ({
  value,
  onChange,
  onSave,
  onCancel,
  placeholder = "Enter text...",
  multiline = false,
  className = ""
}) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSave = () => {
    onChange(localValue);
    onSave();
  };

  const handleCancel = () => {
    setLocalValue(value);
    onCancel();
  };

  return (
    <Card className={`p-3 shadow-lg border-2 border-primary/20 w-full ${className}`}>
      <div className="space-y-3 w-full">
        <RichTextEditor
          content={localValue}
          onChange={setLocalValue}
          placeholder={placeholder}
          className="w-full"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
};