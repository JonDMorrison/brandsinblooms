import type { QueryClient } from "@tanstack/react-query";
import type { AskBloomResourceType, ResourceFocus } from "@/types/askBloom";

export interface AskBloomResourceAccessor {
  getResourceFocus: (
    resourceId: string,
    queryClient: QueryClient,
  ) => ResourceFocus | null;
}

const registry = new Map<AskBloomResourceType, AskBloomResourceAccessor>();
const listeners = new Set<() => void>();
let registryVersion = 0;

const notifyRegistryListeners = () => {
  registryVersion += 1;
  listeners.forEach((listener) => listener());
};

export function subscribeToAskBloomResourceRegistry(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getAskBloomResourceRegistrySnapshot() {
  return registryVersion;
}

export function registerResourceAccessor(
  resourceType: AskBloomResourceType,
  accessor: AskBloomResourceAccessor,
) {
  registry.set(resourceType, accessor);
  notifyRegistryListeners();

  return () => {
    if (registry.get(resourceType) === accessor) {
      registry.delete(resourceType);
      notifyRegistryListeners();
    }
  };
}

export function getResourceFocusFromCache(
  resourceType: AskBloomResourceType,
  resourceId: string,
  queryClient: QueryClient,
) {
  const accessor = registry.get(resourceType);
  if (!accessor) {
    return null;
  }

  return accessor.getResourceFocus(resourceId, queryClient);
}
