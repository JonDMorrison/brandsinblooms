import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SequentialImageLoader } from '@/services/SequentialImageLoader';

interface Task {
  id: string;
  image_idea: string | null;
  image_url: string | null;
  image_generation_status: string | null;
  post_type: string;
}

/**
 * Hook to automatically queue AI image generation for tasks that need it
 * Includes retry logic for failed generations
 */
export const useAutoImageGeneration = (tasks: Task[]) => {
  const { user } = useAuth();
  const queuedTasksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !tasks || tasks.length === 0) return;

    // Find tasks that need AI generation (including failed attempts for retry)
    const tasksNeedingGeneration = tasks.filter(task => 
      task.id && 
      task.image_idea && 
      !task.image_url &&
      (task.image_generation_status === 'pending' || task.image_generation_status === 'failed') &&
      !queuedTasksRef.current.has(task.id) // Don't re-queue tasks already in queue
    );

    if (tasksNeedingGeneration.length === 0) return;

    console.log('[AutoImageGeneration] Found', tasksNeedingGeneration.length, 'tasks needing AI generation');

    // Queue each task for AI generation
    tasksNeedingGeneration.forEach(task => {
      console.log('[AutoImageGeneration] Queuing task:', task.id, 'with prompt:', task.image_idea);
      
      // Mark as queued
      queuedTasksRef.current.add(task.id);
      
      SequentialImageLoader.addToQueue(
        task.image_idea!,
        'normal',
        task.id,
        user.id
      )
      .then(() => {
        console.log('[AutoImageGeneration] Successfully processed task:', task.id);
      })
      .catch(error => {
        console.error('[AutoImageGeneration] Failed to queue task:', task.id, error);
        // Remove from queued set so it can be retried
        queuedTasksRef.current.delete(task.id);
      });
    });
  }, [tasks, user]);
};
