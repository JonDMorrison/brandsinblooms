import { Check } from "lucide-react";
import { GlassCard } from "./glass";
import {
  GUIDE_CHECKMARKS,
  GUIDE_PILLARS,
  GUIDE_SECTION_HEADER,
} from "./content/guideContent";
import "./homepageGuide.css";

interface HomepageGuideSectionProps {
  isActive: boolean;
  motionEnabled: boolean;
}

export const HomepageGuideSection = ({
  isActive,
  motionEnabled,
}: HomepageGuideSectionProps) => (
  <div
    className="hp-guide"
    data-active={isActive}
    data-motion-enabled={motionEnabled}
    data-testid="homepage-guide"
  >
    <div className="hp-guide__inner">
      <div className="hp-guide__copy">
        <p className="hp-guide__eyebrow">{GUIDE_SECTION_HEADER.eyebrow}</p>
        <h2 className="hp-guide__headline">
          {GUIDE_SECTION_HEADER.headline}
        </h2>
        <p className="hp-guide__subtext">{GUIDE_SECTION_HEADER.subtext}</p>

        <ul className="hp-guide__checks" aria-label="Why BloomSuite fits garden retail">
          {GUIDE_CHECKMARKS.map((item) => (
            <li key={item.label} className="hp-guide__check">
              <span className="hp-guide__check-icon" aria-hidden="true">
                <Check />
              </span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="hp-guide__pillars" aria-label="Platform pillars">
        {GUIDE_PILLARS.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <GlassCard
              key={pillar.title}
              padding="md"
              className="hp-guide-pillar"
            >
              <span className="hp-guide-pillar__icon" aria-hidden="true">
                <Icon />
              </span>
              <h3 className="hp-guide-pillar__title">{pillar.title}</h3>
              <p className="hp-guide-pillar__description">
                {pillar.description}
              </p>
            </GlassCard>
          );
        })}
      </div>
    </div>
  </div>
);

export default HomepageGuideSection;
