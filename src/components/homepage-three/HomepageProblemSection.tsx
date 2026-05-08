import { GlassCard, SectionHeader } from "./glass";
import {
  PROBLEM_CARDS,
  PROBLEM_SECTION_HEADER,
} from "./content/problemContent";
import "./homepageProblem.css";

interface HomepageProblemSectionProps {
  isActive: boolean;
  motionEnabled: boolean;
}

export const HomepageProblemSection = ({
  isActive,
  motionEnabled,
}: HomepageProblemSectionProps) => (
  <div
    className="hp-problem"
    data-active={isActive}
    data-motion-enabled={motionEnabled}
    data-testid="homepage-problem"
  >
    <div className="hp-problem__inner">
      <SectionHeader
        eyebrow={PROBLEM_SECTION_HEADER.eyebrow}
        headline={PROBLEM_SECTION_HEADER.headline}
        subtext={PROBLEM_SECTION_HEADER.subtext}
        align="center"
        isActive={isActive}
        className="hp-problem__header"
      />

      <div className="hp-problem__grid" aria-label="Garden centre marketing pain points">
        {PROBLEM_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <GlassCard
              key={card.title}
              padding="md"
              className="hp-problem-card"
            >
              <span className="hp-problem-card__icon" aria-hidden="true">
                <Icon />
              </span>
              <h3 className="hp-problem-card__title">{card.title}</h3>
              <p className="hp-problem-card__description">{card.description}</p>
            </GlassCard>
          );
        })}
      </div>
    </div>
  </div>
);

export default HomepageProblemSection;
