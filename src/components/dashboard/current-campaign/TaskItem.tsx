
import { AccordionTaskItem } from "./AccordionTaskItem";

interface TaskItemProps {
  task: any;
  onClick: (task: any) => void;
  onTaskUpdate?: () => void;
}

export const TaskItem = ({ task, onClick, onTaskUpdate }: TaskItemProps) => {
  return (
    <AccordionTaskItem
      task={task}
      onClick={onClick}
      onTaskUpdate={onTaskUpdate}
    />
  );
};
