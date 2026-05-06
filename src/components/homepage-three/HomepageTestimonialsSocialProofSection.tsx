import { useRef, useState } from "react";
import type { CSSProperties, UIEvent } from "react";
import { ArrowRight, Star } from "lucide-react";
import {
  SOCIAL_PROOF_AVATARS,
  SOCIAL_PROOF_COPY,
  SOCIAL_PROOF_COUNT,
  SOCIAL_PROOF_RATING,
  TESTIMONIAL_CARDS_LABEL,
  TESTIMONIAL_DOTS_LABEL,
  TESTIMONIAL_RATING_MAX,
  TESTIMONIALS,
  TESTIMONIALS_SECTION_HEADER,
  type SocialProofAvatarConfig,
  type TestimonialConfig,
} from "./content/testimonialsSocialProofContent";
import "./homepageTestimonials.css";

interface HomepageTestimonialsSocialProofSectionProps {
  isActive: boolean;
  motionEnabled: boolean;
}

const StarRating = ({
  rating,
  ratingLabel,
  className,
  starClassName,
}: {
  rating: number;
  ratingLabel: string;
  className: string;
  starClassName: string;
}) => {
  const visibleStars = Math.min(
    Math.max(Math.round(rating), 0),
    TESTIMONIAL_RATING_MAX,
  );

  return (
    <div className={className} aria-label={ratingLabel}>
      {Array.from({ length: visibleStars }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={starClassName}
          fill="currentColor"
          stroke="currentColor"
        />
      ))}
    </div>
  );
};

const TestimonialCard = ({
  testimonial,
  refCallback,
}: {
  testimonial: TestimonialConfig;
  refCallback: (node: HTMLDivElement | null) => void;
}) => {
  const titleId = `hp-testimonial-person-${testimonial.id}`;
  const quoteId = `hp-testimonial-quote-${testimonial.id}`;

  return (
    <div
      ref={refCallback}
      className="hp-testimonial-card-shell"
      data-featured={testimonial.featured ? "true" : "false"}
    >
      <article
        className="hp-testimonial-card"
        data-featured={testimonial.featured ? "true" : "false"}
        data-entry-direction={testimonial.entryDirection}
        aria-labelledby={titleId}
        aria-describedby={quoteId}
        style={
          {
            "--hp-testimonial-delay": `${testimonial.delayMs}ms`,
            "--hp-testimonial-avatar-gradient": testimonial.avatarGradient,
          } as CSSProperties
        }
      >
        <div className="hp-testimonial-card__content">
          <StarRating
            rating={testimonial.rating}
            ratingLabel={testimonial.ratingLabel}
            className="hp-testimonial-card__rating"
            starClassName="hp-testimonial-card__star"
          />

          <blockquote className="hp-testimonial-card__quote-wrap">
            <p id={quoteId} className="hp-testimonial-card__quote">
              {testimonial.quote}
            </p>
          </blockquote>
        </div>

        <footer className="hp-testimonial-card__attribution">
          <span
            className="hp-testimonial-avatar"
            role="img"
            aria-label={`${testimonial.name} initials`}
          >
            {testimonial.initials}
          </span>
          <span className="hp-testimonial-card__person">
            <cite id={titleId} className="hp-testimonial-card__name">
              {testimonial.name}
            </cite>
            <span className="hp-testimonial-card__title">
              {testimonial.title}
            </span>
          </span>
        </footer>
      </article>
    </div>
  );
};

const SocialProofAvatar = ({ avatar }: { avatar: SocialProofAvatarConfig }) => (
  <span
    className="hp-social-proof__avatar"
    role="img"
    aria-label={avatar.label}
    style={
      {
        "--hp-social-avatar-gradient": avatar.gradient,
        "--hp-social-avatar-delay": `${avatar.delayMs}ms`,
      } as CSSProperties
    }
  >
    {avatar.initials}
  </span>
);

export const HomepageTestimonialsSocialProofSection = ({
  isActive,
  motionEnabled,
}: HomepageTestimonialsSocialProofSectionProps) => {
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  const updateActiveCardFromScroll = (container: HTMLDivElement) => {
    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const [index, card] of cardRefs.current.entries()) {
      if (!card) {
        continue;
      }

      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const distance = Math.abs(cardCenter - containerCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    }

    setActiveCardIndex(closestIndex);
  };

  const handleCarouselScroll = (event: UIEvent<HTMLDivElement>) => {
    updateActiveCardFromScroll(event.currentTarget);
  };

  const handleDotClick = (index: number) => {
    setActiveCardIndex(index);
    cardRefs.current[index]?.scrollIntoView?.({
      behavior: motionEnabled ? "smooth" : "auto",
      block: "nearest",
      inline: "center",
    });
  };

  return (
    <div
      className="hp-testimonials"
      data-active={isActive}
      data-motion-enabled={motionEnabled}
      data-testid="homepage-testimonials-social-proof"
    >
      <div className="hp-testimonials__inner">
        <header
          className="hp-testimonials__header"
          aria-labelledby="hp-testimonials-title"
        >
          <p className="hp-testimonials__eyebrow">
            <span
              className="hp-testimonials__eyebrow-line"
              aria-hidden="true"
            />
            <span className="hp-testimonials__eyebrow-text">
              {TESTIMONIALS_SECTION_HEADER.eyebrow}
            </span>
          </p>
          <h2 id="hp-testimonials-title" className="hp-testimonials__headline">
            {TESTIMONIALS_SECTION_HEADER.headline}
          </h2>
          <p className="hp-testimonials__subtext">
            {TESTIMONIALS_SECTION_HEADER.subtext}
          </p>
        </header>

        <div
          className="hp-testimonials__cards"
          aria-label={TESTIMONIAL_CARDS_LABEL}
          data-homepage-gesture-lock="true"
          onScroll={handleCarouselScroll}
        >
          {TESTIMONIALS.map((testimonial, index) => (
            <TestimonialCard
              key={testimonial.id}
              testimonial={testimonial}
              refCallback={(node) => {
                cardRefs.current[index] = node;
              }}
            />
          ))}
        </div>

        <div
          className="hp-testimonials__dots"
          aria-label={TESTIMONIAL_DOTS_LABEL}
        >
          {TESTIMONIALS.map((testimonial, index) => (
            <button
              key={`${testimonial.id}-dot`}
              type="button"
              className="hp-testimonials__dot"
              data-active={activeCardIndex === index}
              aria-label={testimonial.name}
              aria-pressed={activeCardIndex === index}
              onClick={() => handleDotClick(index)}
            />
          ))}
        </div>

        <div className="hp-social-proof" aria-label={SOCIAL_PROOF_COPY}>
          <div className="hp-social-proof__row">
            <div className="hp-social-proof__avatar-stack" aria-hidden="true">
              {SOCIAL_PROOF_AVATARS.map((avatar) => (
                <SocialProofAvatar key={avatar.id} avatar={avatar} />
              ))}
              <span
                className="hp-social-proof__avatar hp-social-proof__avatar--count"
                style={
                  {
                    "--hp-social-avatar-delay": `${SOCIAL_PROOF_COUNT.delayMs}ms`,
                  } as CSSProperties
                }
              >
                {SOCIAL_PROOF_COUNT.label}
              </span>
            </div>
            <p className="hp-social-proof__text">
              <span>{SOCIAL_PROOF_COPY}</span>
              <ArrowRight
                className="hp-social-proof__arrow"
                aria-hidden="true"
              />
            </p>
          </div>

          <div className="hp-social-proof__rating">
            <StarRating
              rating={SOCIAL_PROOF_RATING.rating}
              ratingLabel={SOCIAL_PROOF_RATING.ratingLabel}
              className="hp-social-proof__rating-stars"
              starClassName="hp-social-proof__rating-star"
            />
            <span className="hp-social-proof__rating-score">
              {SOCIAL_PROOF_RATING.score}
            </span>
            <span
              className="hp-social-proof__rating-separator"
              aria-hidden="true"
            >
              ·
            </span>
            <span className="hp-social-proof__rating-count">
              {SOCIAL_PROOF_RATING.reviewCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomepageTestimonialsSocialProofSection;
