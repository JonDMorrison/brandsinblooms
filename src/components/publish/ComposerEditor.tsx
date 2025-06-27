
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Bold, Italic, Link, Crop, Image, Settings, MousePointer } from 'lucide-react';
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
      <Card className="h-full flex items-center justify-center bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="text-center p-8 max-w-md">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <MousePointer className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-[#3E5A6B] mb-3">Ready to publish?</h3>
          <p className="text-gray-600 mb-4">
            Select a post from the <strong>Social Content Queue</strong> on the left to start editing and publishing your content.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <p className="font-medium mb-2">What you can do here:</p>
            <ul className="text-left space-y-1">
              <li>• Edit captions and content</li>
              <li>• Add or change images</li>
              <li>• Schedule posts for later</li>
              <li>• Publish immediately to social media</li>
            </ul>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
      {/* Toolbar - Fixed */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-[#3E5A6B] h-8 w-8 p-0">
            <Bold className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-[#3E5A6B] h-8 w-8 p-0">
            <Italic className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-[#3E5A6B] h-8 w-8 p-0">
            <Link className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-[#3E5A6B] h-8 w-8 p-0">
            <Crop className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-3">
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
            className="bg-[#68BEB9] hover:bg-[#56a7a1] text-white text-sm h-8"
            size="sm"
          >
            <Settings className="w-4 h-4 mr-2" />
            Publish
          </Button>
        </div>
      </div>

      {/* Content Area - Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Media Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[#3E5A6B]">Media</label>
              <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {selectedContent.platform?.toUpperCase()} Post
              </div>
            </div>
            
            <div className="w-full max-w-sm aspect-square bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden">
              {mediaUrl ? (
                <img 
                  src={mediaUrl} 
                  alt="Content media" 
                  className="w-full h-full object-cover rounded-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="text-center p-6">
                          <div class="w-12 h-12 text-gray-400 mx-auto mb-3">📷</div>
                          <p class="text-gray-600 font-medium mb-1">Media not available</p>
                          <p class="text-gray-500 text-sm">Click to upload new media</p>
                        </div>
                      `;
                    }
                  }}
                />
              ) : (
                <div className="text-center p-6">
                  <Image className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium mb-1">Drop media here</p>
                  <p className="text-gray-500 text-sm">or click to browse</p>
                  <Button variant="outline" className="mt-3" size="sm">
                    Choose File
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Caption Section */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-[#3E5A6B]">Caption</label>
            <Textarea
              value={caption}
              onChange={(e) => handleCaptionChange(e.target.value)}
              placeholder="Write your caption here..."
              className={cn(
                "min-h-[160px] resize-none border-gray-300 focus:border-[#68BEB9] focus:ring-[#68BEB9]/20",
                "text-base leading-relaxed",
                isOverLimit && "border-red-300 focus:border-red-500 focus:ring-red-500/20"
              )}
              style={{ caretColor: '#68BEB9' }}
            />
            
            {isOverLimit && (
              <p className="text-red-600 text-sm font-medium">
                Caption exceeds the {maxCharacters} character limit
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
