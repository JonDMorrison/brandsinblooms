
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImageGallery } from '@/components/new-dashboard/ImageGallery';
import { 
  Bold, 
  Italic, 
  Link, 
  List,
  Minus
} from 'lucide-react';

interface ComposerPanelProps {
  selectedDraft: any;
  socialConnections: any[];
  onTaskUpdate: () => void;
}

export const ComposerPanel = ({ selectedDraft, socialConnections, onTaskUpdate }: ComposerPanelProps) => {
  const [content, setContent] = useState('');
  const [characterCount, setCharacterCount] = useState(0);

  useEffect(() => {
    if (selectedDraft?.ai_output) {
      setContent(selectedDraft.ai_output);
      setCharacterCount(selectedDraft.ai_output.length);
    } else {
      setContent('');
      setCharacterCount(0);
    }
  }, [selectedDraft]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setCharacterCount(value.length);
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6 h-full border border-white/20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#3E5A6B]">Composer</h2>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 h-[400px]">
        {/* Left 3 columns - Editor */}
        <div className="col-span-3 flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Bold className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Italic className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Link className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <List className="w-4 h-4" />
            </Button>
            <div className="ml-auto">
              <Minus className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col">
            <Textarea
              placeholder={selectedDraft ? "Edit your content..." : "Select a draft from the tray to start editing"}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className="flex-1 resize-none border-0 shadow-none focus:ring-0 text-sm"
              disabled={!selectedDraft}
            />
            
            {/* Character Counter */}
            <div className="flex justify-between items-center mt-2 pt-2 border-t">
              <span className="text-xs text-gray-500">
                {characterCount} characters
              </span>
              {selectedDraft && (
                <Button 
                  size="sm" 
                  className="bg-[#68BEB9] hover:bg-[#5AA8A3] text-white"
                  onClick={onTaskUpdate}
                >
                  Save
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right column - Image Gallery */}
        <div className="col-span-1">
          <ImageGallery selectedDraft={selectedDraft} />
        </div>
      </div>
    </div>
  );
};
