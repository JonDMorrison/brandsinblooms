
import React from 'react';
import { TaskItem } from './TaskItem';

// Conditional import for SwipeableList
let SwipeableList: any = null;

try {
  const swipeableModule = require('react-swipeable-list');
  SwipeableList = swipeableModule.SwipeableList;
  // Import styles if available
  require('react-swipeable-list/dist/styles.css');
} catch (e) {
  // Fallback component if react-swipeable-list is not available
  SwipeableList = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
}

interface CampaignContentListProps {
  tasks: any[];
  onTaskClick: (task: any) => void;
  onTaskUpdate: () => void;
}

export const CampaignContentList = ({ tasks, onTaskClick, onTaskUpdate }: CampaignContentListProps) => {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>No content generated yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <SwipeableList>
        {tasks.map((task, index) => (
          <div key={task.id}>
            <TaskItem
              task={task}
              onClick={onTaskClick}
              onTaskUpdate={onTaskUpdate}
            />
            {index < tasks.length - 1 && (
              <div className="h-px bg-gray-200 dark:bg-gray-700 mx-5" />
            )}
          </div>
        ))}
      </SwipeableList>
    </div>
  );
};
