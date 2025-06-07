
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { ReadyPostModal } from "./ReadyPostModal";
import { ReadyToPostEmptyState } from "./ready-to-post/ReadyToPostEmptyState";
import { ReadyToPostItem } from "./ready-to-post/ReadyToPostItem";

interface ReadyToPostCardProps {
  tasks: any[];
  onTaskClick?: (task: any) => void;
}

export const ReadyToPostCard = ({ tasks, onTaskClick }: ReadyToPostCardProps) => {
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const readyTasks = tasks.filter(task => task.status === 'scheduled');

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  const handleTaskUpdate = () => {
    // Trigger refresh if needed
    if (onTaskClick) {
      // This will refresh the parent component's data
      onTaskClick(selectedTask);
    }
  };

  if (readyTasks.length === 0) {
    return <ReadyToPostEmptyState />;
  }

  const displayedTasks = showAllTasks ? readyTasks : readyTasks.slice(0, 5);

  return (
    <>
      <Card className="border-secondary/30">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Ready to Post
            <Badge className="bg-secondary/20 text-secondary-foreground">
              {readyTasks.length}
            </Badge>
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Approved content ready for publishing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {displayedTasks.map((task) => (
            <ReadyToPostItem
              key={task.id}
              task={task}
              onClick={handleTaskClick}
            />
          ))}
          
          {readyTasks.length > 5 && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowAllTasks(!showAllTasks)}
            >
              {showAllTasks ? 'Show Less' : `View All ${readyTasks.length} Ready Posts`}
            </Button>
          )}
        </CardContent>
      </Card>

      <ReadyPostModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onTaskUpdate={handleTaskUpdate}
      />
    </>
  );
};
