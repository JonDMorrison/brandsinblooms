import { create } from "zustand";

export type CreatePath = 'event' | 'seasonal' | 'custom' | null;

type Channel = 'newsletter'|'instagram'|'facebook'|'video'|'blog';

interface CreateFlowState {
  dialogOpen: boolean;
  selectedPath: CreatePath;
  selectedSourceId: string | null; // eventId or seasonalId
  channels: Record<Channel, boolean>;
  bundleId: string | null;
  snapshotId: string | null;
  setDialogOpen: (open: boolean) => void;
  setSelectedPath: (path: CreatePath) => void;
  setSelectedSourceId: (id: string | null) => void;
  setChannels: (next: Partial<Record<Channel, boolean>> | ((prev: Record<Channel, boolean>) => Record<Channel, boolean>)) => void;
  setBundleIds: (bundleId: string | null, snapshotId: string | null) => void;
  reset: () => void;
}

const defaultChannels: Record<Channel, boolean> = {
  instagram: true,
  facebook: true,
  newsletter: true,
  video: true,
  blog: true,
};

export const useCreateFlow = create<CreateFlowState>((set) => ({
  dialogOpen: false,
  selectedPath: null,
  selectedSourceId: null,
  channels: defaultChannels,
  bundleId: null,
  snapshotId: null,
  setDialogOpen: (open) => set({ dialogOpen: open }),
  setSelectedPath: (path) => set({ selectedPath: path }),
  setSelectedSourceId: (id) => set({ selectedSourceId: id }),
  setChannels: (next) => set((state) => ({
    channels: typeof next === 'function' ? (next as any)(state.channels) : { ...state.channels, ...next },
  })),
  setBundleIds: (bundleId, snapshotId) => set({ bundleId, snapshotId }),
  reset: () => set({ dialogOpen: false, selectedPath: null, selectedSourceId: null, channels: defaultChannels, bundleId: null, snapshotId: null }),
}));
