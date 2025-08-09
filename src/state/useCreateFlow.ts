import { create } from "zustand";

export type CreatePath = 'event' | 'seasonal' | 'custom' | null;

interface CreateFlowState {
  dialogOpen: boolean;
  selectedPath: CreatePath;
  selectedSourceId: string | null; // eventId or seasonalId
  bundleId: string | null;
  snapshotId: string | null;
  setDialogOpen: (open: boolean) => void;
  setSelectedPath: (path: CreatePath) => void;
  setSelectedSourceId: (id: string | null) => void;
  setBundleIds: (bundleId: string | null, snapshotId: string | null) => void;
  reset: () => void;
}

export const useCreateFlow = create<CreateFlowState>((set) => ({
  dialogOpen: false,
  selectedPath: null,
  selectedSourceId: null,
  bundleId: null,
  snapshotId: null,
  setDialogOpen: (open) => set({ dialogOpen: open }),
  setSelectedPath: (path) => set({ selectedPath: path }),
  setSelectedSourceId: (id) => set({ selectedSourceId: id }),
  setBundleIds: (bundleId, snapshotId) => set({ bundleId, snapshotId }),
  reset: () => set({ dialogOpen: false, selectedPath: null, selectedSourceId: null, bundleId: null, snapshotId: null }),
}));
