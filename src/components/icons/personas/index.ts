import type { ComponentType } from "react";
import {
  normalizeEntityIconKey,
  type EntityIconProps,
} from "@/components/icons/shared";
import { CurbAppealIcon } from "./CurbAppealIcon";
import { CustomPersonaIcon } from "./CustomPersonaIcon";
import { DIYIcon } from "./DIYIcon";
import { PatioGardenIcon } from "./PatioGardenIcon";
import { PetFriendlyIcon } from "./PetFriendlyIcon";
import { PlantKillerIcon } from "./PlantKillerIcon";
import { PollinatorIcon } from "./PollinatorIcon";
import { SustainableIcon } from "./SustainableIcon";
import { VegGardenIcon } from "./VegGardenIcon";
import { WellnessIcon } from "./WellnessIcon";

export {
  CurbAppealIcon,
  CustomPersonaIcon,
  DIYIcon,
  PatioGardenIcon,
  PetFriendlyIcon,
  PlantKillerIcon,
  PollinatorIcon,
  SustainableIcon,
  VegGardenIcon,
  WellnessIcon,
};

type PersonaIconComponent = ComponentType<EntityIconProps>;

export const SYSTEM_PERSONA_ICONS: Record<string, PersonaIconComponent> = {
  plant_killer_pam: PlantKillerIcon,
  pet_friendly_hannah: PetFriendlyIcon,
  vegetable_garden_veronica: VegGardenIcon,
  veg_garden_veronica: VegGardenIcon,
  sustainable_susie: SustainableIcon,
  patio_gardener_gail: PatioGardenIcon,
  pollinator_paula: PollinatorIcon,
  curb_appeal_ashley: CurbAppealIcon,
  diy_dana: DIYIcon,
  wellness_whitney: WellnessIcon,
};

export function getPersonaIcon(
  personaId?: string | null,
  personaName?: string | null,
  isSystem = false,
) {
  if (!isSystem) {
    return CustomPersonaIcon;
  }

  const keys = [
    normalizeEntityIconKey(personaId),
    normalizeEntityIconKey(personaName),
  ].filter(Boolean);

  for (const key of keys) {
    if (SYSTEM_PERSONA_ICONS[key]) {
      return SYSTEM_PERSONA_ICONS[key];
    }
  }

  return CustomPersonaIcon;
}
