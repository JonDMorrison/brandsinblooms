
import React from "react";
import { Disclosure } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { formatDistanceToNowStrict } from 'date-fns';
import { TaskSwipeActions } from './TaskSwipeActions';
import { TaskItemContent } from './TaskItemContent';
import { TaskItemActions } from './TaskItemActions';
import { StatusBadge } from '@/components/ui/status-badge';
import { PostTypeAvatar } from '@/components/ui/post-type-avatar';
import { MetaBadges } from '@/components/ui/meta-badges';
import { isSupportedPostType, truncateText } from "@/utils/contentUtils";
import { normalizeTask } from "@/utils/normalizeTask";
import { useAuth } from "@/contexts/AuthContext";

// Conditional import for SwipeableListItem
let SwipeableListItem: any = null;

try {
  const swipeableModule = require('react-swipeable-list');
  SwipeableListItem = swipeableModule.SwipeableListItem;
} catch (e) {
  // Fallback component if react-swipeable-list is not available
  SwipeableListItem = ({ children, trailingActions }: { children: React.ReactNode; trailingActions?: React.ReactNode }) => (
    <div className="relative">{children}</div>
  );
}

interface EnhancedAccordionTaskItemProps {
  task: any;
  onClick: (task: any) => void;
  onTaskUpdate?: () => void;
  isFirst?: boolean;
}

export const EnhancedAccordionTaskItem = ({ task, onClick, onTaskUpdate, isFirst = false }: EnhancedAccordionTaskItemProps) => {
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

  // Check if this is a structured newsletter
  const isStructuredNewsletter = normalizedTask.post_type === 'newsletter' && 
                                 hasContent && 
                                 normalizedTask.normalized;

  // Prepare badges (max 2 visible)
  const badges = [];
  if (isPreview && isDeveloper) {
    badges.push({ label: 'DEV preview', variant: 'preview' });
  }
  if (isStructuredNewsletter) {
    badges.push({ label: 'Structured', variant: 'structured' });
  }

  const timeAgo = formatDistanceToNowStrict(new Date(normalizedTask.created_at), { addSuffix: true });

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
      <Disclosure as="div" className="w-full accordion-row">
        {({ open }) => (
          <>
            <Disclosure.Button className={`
              relative flex items-center w-full py-3 px-4 
              hover:bg-slate-50/70 dark:hover:bg-slate-800/50
              transition-colors duration-200
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-500/60 rounded-md
              ${!isFirst ? 'before:border-t before:border-slate-100 dark:before:border-slate-700 before:absolute before:inset-x-0 before:top-0' : ''}
            `}>
              {/* Post Type Avatar */}
              <div className="flex-shrink-0 mr-3">
                <PostTypeAvatar type={normalizedTask.post_type} />
              </div>
              
              {/* Title + Preview */}
              <div className="flex-1 min-w-0 text-left md:w-[45%]">
                <div className="flex flex-col">
                  <span className="font-medium text-slate-900 dark:text-slate-100 capitalize mb-0.5">
                    {normalizedTask.post_type}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
                    {previewText}
                  </span>
                </div>
              </div>
              
              {/* Meta Cluster */}
              <MetaBadges 
                badges={badges}
                wordCount={wordCount}
                timeAgo={timeAgo}
                className="mr-3"
              />
              
              {/* Mobile badges (below title) - only show when needed */}
              <div className="md:hidden absolute left-16 top-14">
                <div className="flex items-center gap-1.5">
                  {badges.slice(0, 2).map((badge, index) => (
                    <StatusBadge key={index} variant={badge.variant as any}>
                      {badge.label}
                    </StatusBadge>
                  ))}
                  {badges.length > 2 && (
                    <span className="text-xs text-slate-400">+{badges.length - 2}</span>
                  )}
                </div>
              </div>
              
              {/* Chevron */}
              <ChevronDownIcon 
                className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
                  open ? 'rotate-180' : ''
                }`} 
              />
            </Disclosure.Button>

            <Disclosure.Panel className="accordion-content transition-all duration-300 ease-in-out overflow-hidden">
              <div className={`mx-4 mb-4 rounded-xl border border-garden-green/30 bg-gradient-to-t from-[#F9FFFA] to-white dark:from-gray-800 dark:to-gray-900 shadow-sm px-5 py-4 ${open ? 'accordion-row--open' : ''}`}>
                {/* Header with badges and meta */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-gray-100 capitalize mb-2">
                      {normalizedTask.post_type}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {badges.map((badge, index) => (
                        <StatusBadge key={index} variant={badge.variant as any}>
                          {badge.label}
                        </StatusBadge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400 dark:text-gray-500">
                    <div>{wordCount > 0 ? `${wordCount} words` : '—'}</div>
                    <div>{timeAgo}</div>
                  </div>
                </div>
                
                {/* Content */}
                <TaskItemContent
                  task={normalizedTask}
                  hasContent={hasContent}
                  cleanContent={normalizedTask.display_content || normalizedTask.ai_output}
                  onClick={onClick}
                />

                {/* Actions */}
                <div className="flex justify-end mt-4">
                  <TaskItemActions
                    task={normalizedTask}
                    hasContent={hasContent}
                    cleanContent={normalizedTask.display_content || normalizedTask.ai_output}
                    onClick={onClick}
                    onTaskUpdate={onTaskUpdate}
                  />
                </div>
              </div>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
    </SwipeableListItem>
  );
};
