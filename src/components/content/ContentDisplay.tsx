
import React from 'react';
import { ContentHeader } from './display/ContentHeader';
import { ContentBody } from './display/ContentBody';
import { ContentFooter } from './display/ContentFooter';
import { ImageDisplay } from './display/ImageDisplay';

interface ContentDisplayProps {
  task: any;
  onTaskUpdate?: () => void;
  onViewFull?: (task: any) => void;
  compact?: boolean;
}

export const ContentDisplay = ({ task, onTaskUpdate, onViewFull, compact = false }: ContentDisplayProps) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <ContentHeader 
        task={task} 
        onTaskUpdate={onTaskUpdate}
        compact={compact}
      />
      
      <div className="p-4 space-y-4">
        <ContentBody task={task} onViewFull={onViewFull} />
        
        {task.ai_output && (
          <ImageDisplay 
            task={task}
            onViewFull={onViewFull}
          />
        )}
      </div>
      
      <ContentFooter task={task} />
    </div>
  );
};
