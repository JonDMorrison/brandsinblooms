import type { AskBloomResourceType } from "@/types/askBloom";

export interface AskBloomResourceSyncDetail {
  resourceType: AskBloomResourceType;
  resourceId: string;
  toolName: string;
  status: "completed" | "failed";
}

const ASK_BLOOM_RESOURCE_SYNC_EVENT = "ask-bloom-resource-sync";

export const dispatchAskBloomResourceSync = (
  detail: AskBloomResourceSyncDetail,
) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AskBloomResourceSyncDetail>(
      ASK_BLOOM_RESOURCE_SYNC_EVENT,
      { detail },
    ),
  );
};

export const subscribeAskBloomResourceSync = (
  listener: (detail: AskBloomResourceSyncDetail) => void,
) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleEvent = (event: Event) => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    // Only publishAskBloomResourceSync dispatches this event name.
    const syncEvent: CustomEvent<AskBloomResourceSyncDetail> = event;
    if (!syncEvent.detail) {
      return;
    }

    listener(syncEvent.detail);
  };

  window.addEventListener(ASK_BLOOM_RESOURCE_SYNC_EVENT, handleEvent);
  return () => {
    window.removeEventListener(ASK_BLOOM_RESOURCE_SYNC_EVENT, handleEvent);
  };
};
