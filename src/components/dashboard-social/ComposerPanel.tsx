
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useDashboard } from '@/contexts/DashboardContext';
import { PulsePanel } from '@/components/dashboard-social/PulsePanel';
import { 
  Bold, 
  Italic, 
  Link, 
  List,
  MoreVertical,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const ComposerPanel = () => {
  const { activeDraft, refreshData } = useDashboard();
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
      const { error } = await supabase
        .from('content_tasks')
        .update({ ai_output: content })
        .eq('id', activeDraft.id);

      if (error) throw error;

      setLastSaved(new Date());
      toast.success('Content saved');
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error('Failed to save content');
    } finally {
      setSaving(false);
    }
  }, [activeDraft, content]);

  // Auto-save with debounce
  useEffect(() => {
    if (!activeDraft || content === activeDraft.ai_output) return;

    const timer = setTimeout(() => {
      saveContent();
    }, 10000); // 10 seconds

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

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6 h-[440px] border border-white/20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#3E5A6B]">Composer</h2>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-gray-500">{formatLastSaved()}</span>
          )}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 h-[350px]">
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
              placeholder={activeDraft ? "Edit your content..." : "Select a draft from the tray to start editing"}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className="flex-1 resize-none border-0 shadow-none focus:ring-0 text-sm"
              disabled={!activeDraft}
            />
            
            {/* Bottom Bar */}
            <div className="flex justify-between items-center mt-2 pt-2 border-t">
              <span className={`text-xs ${getCharacterLimitColor()}`}>
                {characterCount} characters
              </span>
              {activeDraft && (
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={saveContent}
                  disabled={saving}
                  className="text-[#68BEB9] hover:text-[#5AA8A3] hover:bg-[#68BEB9]/10"
                >
                  <Save className="w-4 h-4 mr-1" />
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
