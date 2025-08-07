import React, { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SMSNodeData {
  content: string;
  characterCount: number;
}

interface SMSNodeEditorProps {
  data: SMSNodeData;
  onSave: (data: SMSNodeData) => void;
  onCancel: () => void;
}

export const SMSNodeEditor: React.FC<SMSNodeEditorProps> = ({
  data,
  onSave,
  onCancel
}) => {
  const [content, setContent] = useState(data.content || '');
  const characterCount = content.length;
  const isOverLimit = characterCount > 160;

  useEffect(() => {
    setContent(data.content || '');
  }, [data.content]);

  const handleSave = () => {
    if (content.trim()) {
      onSave({
        content: content.trim(),
        characterCount
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
  };

  return (
    <Card className="w-full max-w-md" onKeyDown={handleKeyDown}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          💬 Edit SMS Message
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sms-content">SMS Message *</Label>
          <Textarea
            id="sms-content"
            placeholder="Enter your SMS message..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={`min-h-[120px] ${isOverLimit ? 'border-destructive' : ''}`}
            autoFocus
          />
          
          <div className="flex justify-between text-sm">
            <span className={isOverLimit ? 'text-destructive' : 'text-muted-foreground'}>
              {characterCount}/160 characters
            </span>
            {isOverLimit && (
              <span className="text-destructive font-medium">
                Message too long!
              </span>
            )}
          </div>
          
          {!content.trim() && (
            <p className="text-sm text-destructive">SMS content is required</p>
          )}
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> Keep messages under 160 characters to avoid split charges. 
            Use personalization tokens like {'{name}'} for better engagement.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!content.trim() || isOverLimit}
          >
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};