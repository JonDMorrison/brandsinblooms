import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useDashboardContext } from '@/contexts/DashboardContext';
import { PulsePanel } from '@/components/dashboard-social/PulsePanel';
import { 
  Bold, 
  Italic, 
  Link, 
  List,
  MoreVertical,
  Save,
  Clock,
  Edit,
  Trash2,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export const ComposerPanel = () => {
  const { 
    activeDraft, 
    updateDraftContent, 
    composerMode, 
    setComposerMode 
  } = useDashboardContext();
  
  const [content, setContent] = useState('');
  const [characterCount, setCharacterCount] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeDraft?.ai_output) {
      setContent(activeDraft.ai_output);
      setCharacterCount(activeDraft.ai_output.length);
    } else {
      setContent('');
      setCharacterCount(0);
    }
  }, [activeDraft]);

  const saveContent = useCallback(async () => {
    if (!activeDraft || !content.trim()) return;

    setSaving(true);
    try {
      await updateDraftContent(activeDraft.id, content);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving content:', error);
    } finally {
      setSaving(false);
    }
  }, [activeDraft, content, updateDraftContent]);

  // Auto-save with debounce
  useEffect(() => {
    if (!activeDraft || content === activeDraft.ai_output) return;

    const timer = setTimeout(() => {
      saveContent();
    }, 3000); // 3 seconds for better UX

    return () => clearTimeout(timer);
  }, [content, activeDraft, saveContent]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setCharacterCount(value.length);
  };

  const getCharacterLimitColor = () => {
    if (characterCount > 2200) return 'text-red-600';
    if (characterCount > 2000) return 'text-orange-600';
    return 'text-gray-500';
  };

  const formatLastSaved = () => {
    if (!lastSaved) return '';
    const seconds = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    if (seconds < 60) return `Saved ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `Saved ${minutes}m ago`;
  };

  const getComposerModeLabel = () => {
    switch (composerMode) {
      case 'scheduled':
        return 'Scheduled';
      case 'draft':
      default:
        return 'Draft';
    }
  };

  const getComposerActions = () => {
    if (composerMode === 'scheduled') {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreVertical className="w-4 h-4 mr-1" />
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Clock className="w-4 h-4 mr-2" />
              Reschedule
            </DropdownMenuItem>
            <DropdownMenuItem>
              <X className="w-4 h-4 mr-2" />
              Unschedule
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return null;
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6 h-[440px] border border-white/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[#3E5A6B]">Composer</h2>
          {activeDraft && (
            <Badge 
              variant="outline" 
              className={
                composerMode === 'scheduled' 
                  ? "border-[#68BEB9] text-[#68BEB9]" 
                  : "border-gray-400 text-gray-600"
              }
            >
              {getComposerModeLabel()}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-gray-500">{formatLastSaved()}</span>
          )}
          {getComposerActions()}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 h-[380px]">
        {/* Editor - Left 3 columns */}
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
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col">
            <Textarea
              placeholder={
                activeDraft 
                  ? composerMode === 'scheduled' 
                    ? "Edit your scheduled content..."
                    : "Edit your content..." 
                  : "Select a draft from the tray to start editing"
              }
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className="flex-1 resize-none border-0 shadow-none focus:ring-0 text-sm"
              disabled={!activeDraft}
            />
            
            {/* Compact Bottom Bar */}
            <div className="flex justify-between items-center mt-2 pt-1 border-t border-gray-100">
              <span className={`text-xs ${getCharacterLimitColor()}`}>
                {characterCount} chars
              </span>
              {activeDraft && (
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={saveContent}
                  disabled={saving}
                  className="text-[#68BEB9] hover:text-[#5AA8A3] hover:bg-[#68BEB9]/10 h-6 px-2 text-xs"
                >
                  <Save className="w-3 h-3 mr-1" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Pulse Panel - Right column */}
        <div className="col-span-1">
          <PulsePanel />
        </div>
      </div>
    </div>
  );
};
