interface ImageRequest {
  id: string;
  prompt: string;
  priority: 'high' | 'normal';
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
  
  async addToQueue(prompt: string, priority: 'high' | 'normal' = 'normal'): Promise<any> {
    return new Promise((resolve, reject) => {
      const request: ImageRequest = {
        id: `${Date.now()}-${Math.random()}`,
        prompt,
        priority,
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
      const { mediaSelector } = await import('@/utils/mediaSelector');
      const result = await mediaSelector({ prompt: request.prompt });
      
      // Small delay to prevent flashing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      request.resolve(result);
      this.completed++;
    } catch (error) {
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