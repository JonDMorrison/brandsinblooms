import { GlassCard, SectionHeader } from "./glass";
import {
  DIFFERENTIATOR_CARDS,
  DIFFERENTIATORS_SECTION_HEADER,
} from "./content/differentiatorsContent";
import "./homepageDifferentiators.css";

interface HomepageDifferentiatorsSectionProps {
  isActive: boolean;
  motionEnabled: boolean;
}

export const HomepageDifferentiatorsSection = ({
  isActive,
  motionEnabled,
}: HomepageDifferentiatorsSectionProps) => (
  <div
    className="hp-differentiators"
    data-active={isActive}
    data-motion-enabled={motionEnabled}
    data-testid="homepage-differentiators"
  >
    <div className="hp-differentiators__inner">
      <SectionHeader
        eyebrow={DIFFERENTIATORS_SECTION_HEADER.eyebrow}
        headline={DIFFERENTIATORS_SECTION_HEADER.headline}
        subtext={DIFFERENTIATORS_SECTION_HEADER.subtext}
        align="center"
        isActive={isActive}
        className="hp-differentiators__header"
      />

      <div
        className="hp-differentiators__grid"
        aria-label="What BloomSuite includes beyond software"
      >
        {DIFFERENTIATOR_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <GlassCard
              key={card.title}
              padding="md"
              className="hp-differentiator-card"
            >
              <span className="hp-differentiator-card__icon" aria-hidden="true">
                <Icon />
              </span>
              <h3 className="hp-differentiator-card__title">{card.title}</h3>
              <p className="hp-differentiator-card__description">
                {card.description}
              </p>
            </GlassCard>
          );
        })}
      </div>
    </div>
  </div>
);

export default HomepageDifferentiatorsSection;
