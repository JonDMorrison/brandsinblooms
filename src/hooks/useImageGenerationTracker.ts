import { create } from "zustand";

export type ImageGenerationJobStatus = "generating" | "completed" | "failed";

export interface ImageGenJob {
  status: ImageGenerationJobStatus;
  channel: string;
  imageQuery: string;
  imageUrl: string | null;
  error: string | null;
  startedAt: number;
  completedAt: number | null;
  globalImageId?: string;
  tags?: string[];
}

interface ImageGenerationTrackerState {
  jobs: Map<string, Map<string, ImageGenJob>>;
  startJob: (bundleId: string, channel: string, imageQuery: string) => void;
  completeJob: (
    bundleId: string,
    channel: string,
    imageUrl: string,
    details?: { globalImageId?: string; tags?: string[] },
  ) => void;
  failJob: (bundleId: string, channel: string, error: string) => void;
  retryJob: (bundleId: string, channel: string) => ImageGenJob | undefined;
  getJobsForBundle: (bundleId: string) => Map<string, ImageGenJob> | undefined;
  getJobForChannel: (
    bundleId: string,
    channel: string,
  ) => ImageGenJob | undefined;
  clearBundle: (bundleId: string) => void;
}

function cloneJobsForBundle(
  jobs: Map<string, Map<string, ImageGenJob>>,
  bundleId: string,
) {
  return new Map(jobs.get(bundleId) ?? new Map<string, ImageGenJob>());
}

export const useImageGenerationTracker = create<ImageGenerationTrackerState>(
  (set, get) => ({
    jobs: new Map(),

    startJob: (bundleId, channel, imageQuery) => {
      set((state) => {
        const nextJobs = new Map(state.jobs);
        const bundleJobs = cloneJobsForBundle(state.jobs, bundleId);

        bundleJobs.set(channel, {
          status: "generating",
          channel,
          imageQuery,
          imageUrl: null,
          error: null,
          startedAt: Date.now(),
          completedAt: null,
        });
        nextJobs.set(bundleId, bundleJobs);

        return { jobs: nextJobs };
      });
    },

    completeJob: (bundleId, channel, imageUrl, details) => {
      set((state) => {
        const bundleJobs = state.jobs.get(bundleId);
        const currentJob = bundleJobs?.get(channel);
        if (!currentJob) {
          return state;
        }

        const nextJobs = new Map(state.jobs);
        const nextBundleJobs = cloneJobsForBundle(state.jobs, bundleId);
        nextBundleJobs.set(channel, {
          ...currentJob,
          status: "completed",
          imageUrl,
          error: null,
          completedAt: Date.now(),
          globalImageId: details?.globalImageId,
          tags: details?.tags,
        });
        nextJobs.set(bundleId, nextBundleJobs);

        return { jobs: nextJobs };
      });
    },

    failJob: (bundleId, channel, error) => {
      set((state) => {
        const bundleJobs = state.jobs.get(bundleId);
        const currentJob = bundleJobs?.get(channel);
        if (!currentJob) {
          return state;
        }

        const nextJobs = new Map(state.jobs);
        const nextBundleJobs = cloneJobsForBundle(state.jobs, bundleId);
        nextBundleJobs.set(channel, {
          ...currentJob,
          status: "failed",
          imageUrl: null,
          error,
          completedAt: Date.now(),
        });
        nextJobs.set(bundleId, nextBundleJobs);

        return { jobs: nextJobs };
      });
    },

    retryJob: (bundleId, channel) => {
      const currentJob = get().getJobForChannel(bundleId, channel);
      if (!currentJob) {
        return undefined;
      }

      set((state) => {
        const nextJobs = new Map(state.jobs);
        const nextBundleJobs = cloneJobsForBundle(state.jobs, bundleId);
        nextBundleJobs.set(channel, {
          ...currentJob,
          status: "generating",
          imageUrl: null,
          error: null,
          startedAt: Date.now(),
          completedAt: null,
        });
        nextJobs.set(bundleId, nextBundleJobs);

        return { jobs: nextJobs };
      });

      return get().getJobForChannel(bundleId, channel);
    },

    getJobsForBundle: (bundleId) => get().jobs.get(bundleId),

    getJobForChannel: (bundleId, channel) =>
      get().jobs.get(bundleId)?.get(channel),

    clearBundle: (bundleId) => {
      set((state) => {
        if (!state.jobs.has(bundleId)) {
          return state;
        }

        const nextJobs = new Map(state.jobs);
        nextJobs.delete(bundleId);

        return { jobs: nextJobs };
      });
    },
  }),
);
