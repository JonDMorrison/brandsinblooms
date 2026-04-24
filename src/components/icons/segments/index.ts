import type { ComponentType } from "react";
import {
  normalizeEntityIconKey,
  type EntityIconProps,
} from "@/components/icons/shared";
import { CustomSegmentIcon } from "./CustomSegmentIcon";
import { FrequentBuyerIcon } from "./FrequentBuyerIcon";
import { HighValueIcon } from "./HighValueIcon";
import { LapsedIcon } from "./LapsedIcon";
import { LoyaltyIcon } from "./LoyaltyIcon";
import { NewCustomerIcon } from "./NewCustomerIcon";
import { PerksIcon } from "./PerksIcon";
import { SeasonalIcon } from "./SeasonalIcon";

export {
  CustomSegmentIcon,
  FrequentBuyerIcon,
  HighValueIcon,
  LapsedIcon,
  LoyaltyIcon,
  NewCustomerIcon,
  PerksIcon,
  SeasonalIcon,
};

type SegmentIconComponent = ComponentType<EntityIconProps>;

export const SYSTEM_SEGMENT_ICONS: Record<string, SegmentIconComponent> = {
  perks_members: PerksIcon,
  loyalty_members: LoyaltyIcon,
  high_value: HighValueIcon,
  high_value_customers: HighValueIcon,
  new_customers: NewCustomerIcon,
  lapsed_customers: LapsedIcon,
  seasonal_shoppers: SeasonalIcon,
  frequent_buyers: FrequentBuyerIcon,
};

export function getSegmentIcon(
  segmentId?: string | null,
  segmentName?: string | null,
  isSystem = false,
) {
  if (!isSystem) {
    return CustomSegmentIcon;
  }

  const keys = [
    normalizeEntityIconKey(segmentId),
    normalizeEntityIconKey(segmentName),
  ].filter(Boolean);

  for (const key of keys) {
    if (SYSTEM_SEGMENT_ICONS[key]) {
      return SYSTEM_SEGMENT_ICONS[key];
    }
  }

  return CustomSegmentIcon;
}
