
import React from "react";
import { Disclosure } from '@headlessui/react';
import { ChevronDown } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { getThumbnail } from '@/utils/getThumbnail';
import { TaskSwipeActions } from './TaskSwipeActions';
import { TaskItemContent } from './TaskItemContent';
import { TaskItemActions } from './TaskItemActions';
import { StatusBadge } from '@/components/ui/status-badge';
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

  // Check if this is a structured newsletter
  const isStructuredNewsletter = normalizedTask.post_type === 'newsletter' && 
                                 hasContent && 
                                 normalizedTask.normalized;

  // Prepare badges (max 2 visible)
  const badges = [];
  if (isPreview && isDeveloper) {
    badges.push({ label: 'DEV preview', variant: 'preview' as const });
  }
  if (isStructuredNewsletter) {
    badges.push({ label: 'Structured', variant: 'structured' as const });
  }
  
  const visibleBadges = badges.slice(0, 2);
  const hasMoreBadges = badges.length > 2;

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
            <Disclosure.Button className="flex items-center w-full py-3 px-4 hover:bg-slate-50 dark:hover:bg-gray-800 transition-all duration-200 accordion-row-button">
              {/* Avatar/Thumbnail - 40x40 */}
              <div className="flex-shrink-0 mr-3">
                <img 
                  src={getThumbnail(normalizedTask)} 
                  alt={`${normalizedTask.post_type} thumbnail`}
                  className="w-10 h-10 rounded-lg object-cover bg-slate-100 dark:bg-gray-700 ring-1 ring-slate-200 dark:ring-gray-600"
                  onError={(e) => {
                    e.currentTarget.src = getThumbnail({ post_type: normalizedTask.post_type });
                  }}
                />
              </div>
              
              {/* Title + Preview (flex-1) */}
              <div className="flex-1 min-w-0 text-left">
                <h3 className="text-sm font-medium text-slate-900 dark:text-gray-100 capitalize mb-0.5">
                  {normalizedTask.post_type}
                </h3>
                <p className="text-sm text-slate-500 dark:text-gray-400 line-clamp-1">
                  {previewText}
                </p>
              </div>
              
              {/* Badge Stack - Desktop */}
              <div className="hidden md:flex items-center gap-1.5 mx-3">
                {visibleBadges.map((badge, index) => (
                  <StatusBadge key={index} variant={badge.variant}>
                    {badge.label}
                  </StatusBadge>
                ))}
                {hasMoreBadges && (
                  <span className="text-xs text-slate-400">+{badges.length - 2}</span>
                )}
              </div>
              
              {/* Meta Info */}
              <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400 dark:text-gray-500 mr-3">
                <span>
                  {wordCount > 0 ? `${wordCount} words` : '—'}
                </span>
                <span>
                  {formatDistanceToNowStrict(new Date(normalizedTask.created_at), { addSuffix: true })}
                </span>
              </div>
              
              {/* Chevron */}
              <ChevronDown 
                className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                  open ? 'rotate-180' : ''
                }`} 
              />
            </Disclosure.Button>

            {/* Badge Stack - Mobile (below title) */}
            <div className="md:hidden px-4 pb-2">
              <div className="flex items-center gap-1.5">
                {visibleBadges.map((badge, index) => (
                  <StatusBadge key={index} variant={badge.variant}>
                    {badge.label}
                  </StatusBadge>
                ))}
                {hasMoreBadges && (
                  <span className="text-xs text-slate-400">+{badges.length - 2}</span>
                )}
              </div>
            </div>

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
                        <StatusBadge key={index} variant={badge.variant}>
                          {badge.label}
                        </StatusBadge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400 dark:text-gray-500">
                    <div>{wordCount > 0 ? `${wordCount} words` : '—'}</div>
                    <div>{formatDistanceToNowStrict(new Date(normalizedTask.created_at), { addSuffix: true })}</div>
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
