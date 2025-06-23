
import { EnhancedAccordionTaskItem } from "./EnhancedAccordionTaskItem";

interface TaskItemProps {
  task: any;
  onClick: (task: any) => void;
  onTaskUpdate?: () => void;
}

export const TaskItem = ({ task, onClick, onTaskUpdate }: TaskItemProps) => {
  return (
    <EnhancedAccordionTaskItem
      task={task}
      onClick={onClick}
      onTaskUpdate={onTaskUpdate}
    />
  );
};
