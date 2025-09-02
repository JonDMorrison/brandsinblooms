import { create } from "zustand";

export interface GenerationJob {
  id: string;
  type: 'campaign' | 'bundle' | 'holiday' | 'seasonal' | 'custom';
  title: string;
  status: 'generating' | 'completed' | 'failed';
  progress?: number; // 0-100
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  // Navigation context
  redirectPath?: string;
  sourceId?: string;
  bundleId?: string;
  snapshotId?: string;
}

interface GenerationJobState {
  jobs: Record<string, GenerationJob>;
  activeGenerationCount: number;
  
  // Actions
  startGeneration: (job: Omit<GenerationJob, 'id' | 'startedAt' | 'status'>) => string;
  updateJob: (jobId: string, updates: Partial<GenerationJob>) => void;
  completeJob: (jobId: string, result?: { bundleId?: string; snapshotId?: string }) => void;
  failJob: (jobId: string, error: string) => void;
  removeJob: (jobId: string) => void;
  clearCompletedJobs: () => void;
  
  // Queries
  getJobsByType: (type: GenerationJob['type']) => GenerationJob[];
  getActiveJobs: () => GenerationJob[];
  isGenerating: (type?: GenerationJob['type']) => boolean;
  getJobById: (jobId: string) => GenerationJob | undefined;
}

export const useGenerationJobTracker = create<GenerationJobState>((set, get) => ({
  jobs: {},
  activeGenerationCount: 0,

  startGeneration: (jobData) => {
    const jobId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: GenerationJob = {
      ...jobData,
      id: jobId,
      status: 'generating',
      startedAt: new Date(),
    };
    
    set((state) => ({
      jobs: { ...state.jobs, [jobId]: job },
      activeGenerationCount: state.activeGenerationCount + 1,
    }));
    
    return jobId;
  },

  updateJob: (jobId, updates) => {
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      
      return {
        jobs: {
          ...state.jobs,
          [jobId]: { ...job, ...updates },
        },
      };
    });
  },

  completeJob: (jobId, result) => {
    set((state) => {
      const job = state.jobs[jobId];
      if (!job || job.status !== 'generating') return state;
      
      return {
        jobs: {
          ...state.jobs,
          [jobId]: {
            ...job,
            status: 'completed',
            completedAt: new Date(),
            bundleId: result?.bundleId || job.bundleId,
            snapshotId: result?.snapshotId || job.snapshotId,
          },
        },
        activeGenerationCount: Math.max(0, state.activeGenerationCount - 1),
      };
    });
  },

  failJob: (jobId, error) => {
    set((state) => {
      const job = state.jobs[jobId];
      if (!job || job.status !== 'generating') return state;
      
      return {
        jobs: {
          ...state.jobs,
          [jobId]: {
            ...job,
            status: 'failed',
            completedAt: new Date(),
            error,
          },
        },
        activeGenerationCount: Math.max(0, state.activeGenerationCount - 1),
      };
    });
  },

  removeJob: (jobId) => {
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      
      const { [jobId]: removed, ...remainingJobs } = state.jobs;
      return {
        jobs: remainingJobs,
        activeGenerationCount: job.status === 'generating' 
          ? Math.max(0, state.activeGenerationCount - 1)
          : state.activeGenerationCount,
      };
    });
  },

  clearCompletedJobs: () => {
    set((state) => {
      const activeJobs = Object.entries(state.jobs)
        .filter(([, job]) => job.status === 'generating')
        .reduce((acc, [id, job]) => ({ ...acc, [id]: job }), {});
      
      return { jobs: activeJobs };
    });
  },

  getJobsByType: (type) => {
    const { jobs } = get();
    return Object.values(jobs).filter(job => job.type === type);
  },

  getActiveJobs: () => {
    const { jobs } = get();
    return Object.values(jobs).filter(job => job.status === 'generating');
  },

  isGenerating: (type) => {
    const { jobs } = get();
    const activeJobs = Object.values(jobs).filter(job => job.status === 'generating');
    return type ? activeJobs.some(job => job.type === type) : activeJobs.length > 0;
  },

  getJobById: (jobId) => {
    const { jobs } = get();
    return jobs[jobId];
  },
}));