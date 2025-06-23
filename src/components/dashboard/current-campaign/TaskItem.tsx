
import { EnhancedAccordionTaskItem } from "./EnhancedAccordionTaskItem";

interface TaskItemProps {
  task: any;
  onClick: (task: any) => void;
  onTaskUpdate?: () => void;
  isFirst?: boolean;
}

export const TaskItem = ({ task, onClick, onTaskUpdate, isFirst }: TaskItemProps) => {
  return (
    <EnhancedAccordionTaskItem
      task={task}
      onClick={onClick}
      onTaskUpdate={onTaskUpdate}
      isFirst={isFirst}
    />
  );
};
