interface ImageRequest {
  id: string;
  prompt: string;
  priority: 'high' | 'normal';
  taskId?: string;
  userId?: string;
  resolve: (result: any) => void;
  reject: (error: any) => void;
}

interface LoadingStatus {
  isLoading: boolean;
  current: string | null;
  total: number;
  completed: number;
  queue: string[];
}

class SequentialImageLoaderClass {
  private queue: ImageRequest[] = [];
  private isProcessing = false;
  private completed = 0;
  private listeners: ((status: LoadingStatus) => void)[] = [];
  
  async addToQueue(
    prompt: string, 
    priority: 'high' | 'normal' = 'normal',
    taskId?: string,
    userId?: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const request: ImageRequest = {
        id: `${Date.now()}-${Math.random()}`,
        prompt,
        priority,
        taskId,
        userId,
        resolve,
        reject
      };

      // Insert based on priority
      if (priority === 'high') {
        this.queue.unshift(request);
      } else {
        this.queue.push(request);
      }
      
      this.notifyListeners();
      this.processNext();
    });
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    const request = this.queue.shift()!;
    
    this.notifyListeners();
    
    try {
      // If taskId and userId are provided, use AI generation
      if (request.taskId && request.userId) {
        console.log('[SequentialImageLoader] Using AI generation for task:', request.taskId);
        
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('generate-ai-image', {
          body: {
            taskId: request.taskId,
            imageQuery: request.prompt,
            userId: request.userId
          }
        });

        if (error) throw error;
        
        request.resolve(data);
      } else {
        // Fallback to Unsplash for backward compatibility
        console.log('[SequentialImageLoader] Using Unsplash fallback');
        const { mediaSelector } = await import('@/utils/mediaSelector');
        const result = await mediaSelector({ prompt: request.prompt });
        request.resolve(result);
      }
      
      // Small delay to prevent flashing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.completed++;
    } catch (error) {
      console.error('[SequentialImageLoader] Error:', error);
      request.reject(error);
    }
    
    this.isProcessing = false;
    this.notifyListeners();
    
    // Continue processing queue
    if (this.queue.length > 0) {
      setTimeout(() => this.processNext(), 50);
    }
  }

  getStatus(): LoadingStatus {
    return {
      isLoading: this.isProcessing || this.queue.length > 0,
      current: this.isProcessing ? this.queue[0]?.prompt || null : null,
      total: this.completed + this.queue.length + (this.isProcessing ? 1 : 0),
      completed: this.completed,
      queue: this.queue.map(req => req.prompt)
    };
  }

  subscribe(callback: (status: LoadingStatus) => void) {
    this.listeners.push(callback);
    
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners() {
    const status = this.getStatus();
    this.listeners.forEach(callback => callback(status));
  }

  clearQueue() {
    this.queue.forEach(req => req.reject(new Error('Queue cleared')));
    this.queue = [];
    this.completed = 0;
    this.notifyListeners();
  }
}

export const SequentialImageLoader = new SequentialImageLoaderClass();