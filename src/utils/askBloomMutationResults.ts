import type { ResourceFocus } from "@/types/askBloom";
import {
  buildCampaignFocus,
  buildCustomerFocus,
  buildGenericFocus,
  buildProductFocus,
} from "@/utils/askBloomContextBuilders";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const buildResourceFocusFromMutationResult = (
  currentFocus: ResourceFocus,
  resultData: unknown,
): ResourceFocus | null => {
  if (!isRecord(resultData)) {
    return null;
  }

  switch (currentFocus.resourceType) {
    case "customer":
      return buildCustomerFocus(resultData as never);
    case "product": {
      const nextProduct =
        isRecord(resultData.after) && readString(resultData.after.id)
          ? resultData.after
          : resultData;
      return buildProductFocus(nextProduct as never);
    }
    case "campaign":
      return buildCampaignFocus(resultData as never);
    case "segment": {
      const resourceId = readString(resultData.id) || currentFocus.resourceId;
      const label =
        readString(resultData.name) ||
        currentFocus.resourceLabel ||
        "Segment";
      return buildGenericFocus("segment", resourceId, label, resultData);
    }
    default:
      return null;
  }
};
