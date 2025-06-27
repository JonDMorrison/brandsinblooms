
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Bold, Italic, Link, Crop, Image, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeneratedContent {
  id: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  caption: string;
  mediaUrl?: string;
  platform?: string;
  campaignId?: string;
  createdAt: string;
}

interface ComposerEditorProps {
  selectedContent: GeneratedContent | null;
  onContentUpdate: (content: GeneratedContent) => void;
  onOpenDrawer: () => void;
}

export const ComposerEditor = ({ selectedContent, onContentUpdate, onOpenDrawer }: ComposerEditorProps) => {
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | undefined>('');

  useEffect(() => {
    if (selectedContent) {
      setCaption(selectedContent.caption);
      setMediaUrl(selectedContent.mediaUrl);
    }
  }, [selectedContent]);

  const handleCaptionChange = (newCaption: string) => {
    setCaption(newCaption);
    if (selectedContent) {
      const updatedContent = { ...selectedContent, caption: newCaption };
      onContentUpdate(updatedContent);
    }
  };

  const characterCount = caption.length;
  const maxCharacters = 2000; // Instagram limit
  const isOverLimit = characterCount > maxCharacters;

  if (!selectedContent) {
    return (
      <Card className="h-full flex items-center justify-center bg-white/70 backdrop-blur rounded-2xl shadow-md">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✨</span>
          </div>
          <h3 className="text-xl font-semibold text-[#3E5A6B] mb-2">Select content to edit</h3>
          <p className="text-gray-600">Choose an item from the left panel to start editing</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-white/70 backdrop-blur rounded-2xl shadow-md overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-[#3E5A6B]">
            <Bold className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-[#3E5A6B]">
            <Italic className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-[#3E5A6B]">
            <Link className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-[#3E5A6B]">
            <Crop className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <span 
            className={cn(
              "text-sm font-medium",
              isOverLimit ? "text-red-600" : "text-gray-600"
            )}
          >
            {characterCount}/{maxCharacters}
          </span>
          <Button 
            onClick={onOpenDrawer}
            className="bg-[#68BEB9] hover:bg-[#56a7a1] text-white"
            size="sm"
          >
            <Settings className="w-4 h-4 mr-2" />
            Publish Settings
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 space-y-6">
        {/* Media Section */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-[#3E5A6B]">Media</label>
          <div className="aspect-square max-w-md bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden">
            {mediaUrl ? (
              <img 
                src={mediaUrl} 
                alt="Content media" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center">
                <Image className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-1">Drop media here</p>
                <p className="text-gray-500 text-sm">or click to browse</p>
                <Button variant="outline" className="mt-3">
                  Choose File
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Caption Section */}
        <div className="space-y-3 flex-1">
          <label className="text-sm font-medium text-[#3E5A6B]">Caption</label>
          <Textarea
            value={caption}
            onChange={(e) => handleCaptionChange(e.target.value)}
            placeholder="Write your caption here..."
            className={cn(
              "min-h-[200px] resize-none border-gray-300 focus:border-[#68BEB9] focus:ring-[#68BEB9]/20",
              "text-base leading-relaxed",
              isOverLimit && "border-red-300 focus:border-red-500 focus:ring-red-500/20"
            )}
            style={{ caretColor: '#68BEB9' }}
          />
          
          {isOverLimit && (
            <p className="text-red-600 text-sm">
              Caption exceeds the {maxCharacters} character limit
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};
