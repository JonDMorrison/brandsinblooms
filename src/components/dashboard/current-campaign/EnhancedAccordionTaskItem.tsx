
import React from "react";
import { Disclosure } from '@headlessui/react';
import { SwipeableListItem } from 'react-swipeable-list';
import { ChevronDown } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { getThumbnail } from '@/utils/getThumbnail';
import { TaskSwipeActions } from './TaskSwipeActions';
import { TaskItemContent } from './TaskItemContent';
import { TaskItemActions } from './TaskItemActions';
import { isSupportedPostType, truncateText } from "@/utils/contentUtils";
import { normalizeTask } from "@/utils/normalizeTask";
import { useAuth } from "@/contexts/AuthContext";

interface EnhancedAccordionTaskItemProps {
  task: any;
  onClick: (task: any) => void;
  onTaskUpdate?: () => void;
}

export const EnhancedAccordionTaskItem = ({ task, onClick, onTaskUpdate }: EnhancedAccordionTaskItemProps) => {
  const { user } = useAuth();
  
  // Don't render unsupported post types
  if (!isSupportedPostType(task.post_type)) {
    return null;
  }
  
  // Normalize the task for consistent display
  const normalizedTask = normalizeTask(task);
  const isDeveloper = user?.email === 'jon@getclear.ca';
  const isPreview = normalizedTask.status === 'preview';
  const hasContent = normalizedTask.ai_output && normalizedTask.ai_output.trim() !== '';
  
  // Get preview text
  let previewText = '';
  if (hasContent) {
    const cleanContent = normalizedTask.display_content || normalizedTask.ai_output;
    previewText = truncateText(cleanContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(), 110, '…');
  } else {
    previewText = 'Content will be generated soon...';
  }

  // Get word count estimate
  const wordCount = hasContent ? normalizedTask.ai_output.split(/\s+/).length : 0;

  return (
    <SwipeableListItem 
      trailingActions={
        <TaskSwipeActions 
          task={normalizedTask} 
          onEdit={onClick} 
          onTaskUpdate={onTaskUpdate} 
        />
      }
    >
      <Disclosure as="div" className={`w-full ${isPreview && isDeveloper ? 'relative' : ''}`}>
        {({ open }) => (
          <>
            {/* Accent bar for preview status */}
            {isPreview && isDeveloper && (
              <div className="absolute left-0 top-0 h-full w-1 bg-blue-500 rounded-l-lg" />
            )}
            
            <Disclosure.Button className="flex items-start w-full py-4 px-5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
              {/* Thumbnail */}
              <div className="flex-shrink-0 mr-3">
                <img 
                  src={getThumbnail(normalizedTask)} 
                  alt={`${normalizedTask.post_type} thumbnail`}
                  className="w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-gray-700"
                  onError={(e) => {
                    e.currentTarget.src = getThumbnail({ post_type: normalizedTask.post_type });
                  }}
                />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-[15px] font-medium text-gray-900 dark:text-gray-100 truncate capitalize">
                    {normalizedTask.post_type}
                  </h3>
                  {isPreview && isDeveloper && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      DEV preview
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-1">
                  {previewText}
                </p>
                
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    📝 {wordCount > 0 ? `${wordCount} words` : '—'}
                  </span>
                  <span>
                    {formatDistanceToNowStrict(new Date(normalizedTask.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
              
              {/* Chevron */}
              <ChevronDown 
                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                  open ? 'rotate-180' : ''
                }`} 
              />
            </Disclosure.Button>

            <Disclosure.Panel className="transition-all duration-150 ease-out">
              <div className="px-5 pb-4 space-y-4">
                <div className="h-px bg-gray-200 dark:bg-gray-700" />
                
                <TaskItemContent
                  task={normalizedTask}
                  hasContent={hasContent}
                  cleanContent={normalizedTask.display_content || normalizedTask.ai_output}
                  onClick={onClick}
                />

                <TaskItemActions
                  task={normalizedTask}
                  hasContent={hasContent}
                  cleanContent={normalizedTask.display_content || normalizedTask.ai_output}
                  onClick={onClick}
                  onTaskUpdate={onTaskUpdate}
                />
              </div>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
    </SwipeableListItem>
  );
};
