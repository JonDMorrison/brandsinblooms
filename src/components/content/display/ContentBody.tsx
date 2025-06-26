
import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, RefreshCw } from 'lucide-react';
import { cleanContentForDisplay } from '@/utils/contentUtils';

interface ContentBodyProps {
  task: any;
  onViewFull?: (task: any) => void;
}

export const ContentBody = ({ task, onViewFull }: ContentBodyProps) => {
  const hasContent = task.ai_output && task.ai_output.trim() !== '';
  const isGenerating = task.status === 'generating';

  if (isGenerating) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-800">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          <span className="text-sm">Generating {task.post_type} content...</span>
        </div>
      </div>
    );
  }

  if (!hasContent) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="text-sm text-gray-500 italic">
          No content generated yet
        </div>
      </div>
    );
  }

  const cleanContent = cleanContentForDisplay(task.ai_output, task.post_type);
  const preview = cleanContent.length > 200 ? 
    cleanContent.substring(0, 200) + '...' : cleanContent;

  return (
    <div className="space-y-3">
      <div className="bg-gray-50 rounded-lg p-4">
        {task.post_type === 'instagram' || task.post_type === 'facebook' ? (
          <div className="space-y-2">
            <div className="text-sm text-gray-800 leading-relaxed">
              {preview.split('\n').map((line, index) => (
                <p key={index} className="mb-1">{line}</p>
              ))}
            </div>
            {cleanContent.includes('#') && (
              <div className="flex flex-wrap gap-1 mt-2">
                {cleanContent.match(/#[\w]+/g)?.slice(0, 5).map((tag, index) => (
                  <span key={index} className="text-blue-600 text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div 
            className="text-sm text-gray-800 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        )}
      </div>

      {onViewFull && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onViewFull(task)}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            <Eye className="w-3 h-3 mr-1" />
            View Full
          </Button>
        </div>
      )}
    </div>
  );
};
