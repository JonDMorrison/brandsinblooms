import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { HomepageTestimonialsSocialProofSection } from "./HomepageTestimonialsSocialProofSection";
import {
  SOCIAL_PROOF_AVATARS,
  SOCIAL_PROOF_COPY,
  SOCIAL_PROOF_COUNT,
  TESTIMONIAL_CARDS_LABEL,
  TESTIMONIAL_DOTS_LABEL,
  TESTIMONIALS,
  TESTIMONIALS_SECTION_HEADER,
} from "./content/testimonialsSocialProofContent";

// TEMP: testimonials hidden until verified quotes are sourced
describe.skip("HomepageTestimonialsSocialProofSection", () => {
  it("renders the centered header and three accessible testimonial cards", () => {
    const { container } = render(
      <HomepageTestimonialsSocialProofSection isActive motionEnabled />,
    );

    expect(
      screen.getByText(TESTIMONIALS_SECTION_HEADER.eyebrow),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: TESTIMONIALS_SECTION_HEADER.headline,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(TESTIMONIALS_SECTION_HEADER.subtext),
    ).toBeInTheDocument();

    const cardRegion = screen.getByLabelText(TESTIMONIAL_CARDS_LABEL);
    const cards = within(cardRegion).getAllByRole("article");

    expect(cards).toHaveLength(TESTIMONIALS.length);
    expect(container.querySelectorAll("img")).toHaveLength(0);

    for (const [index, testimonial] of TESTIMONIALS.entries()) {
      const card = cards[index];

      expect(within(card).getByLabelText(testimonial.ratingLabel)).toHaveClass(
        "hp-testimonial-card__rating",
      );
      expect(card.querySelectorAll(".hp-testimonial-card__star")).toHaveLength(
        testimonial.rating,
      );
      expect(within(card).getByText(testimonial.quote)).toHaveClass(
        "hp-testimonial-card__quote",
      );
      expect(within(card).getByText(testimonial.name)).toHaveClass(
        "hp-testimonial-card__name",
      );
      expect(within(card).getByText(testimonial.title)).toHaveClass(
        "hp-testimonial-card__title",
      );
      expect(
        within(card).getByRole("img", {
          name: `${testimonial.name} initials`,
        }),
      ).toHaveTextContent(testimonial.initials);
      expect(card).toHaveStyle(
        `--hp-testimonial-delay: ${testimonial.delayMs}ms`,
      );
      expect(card).toHaveStyle(
        `--hp-testimonial-avatar-gradient: ${testimonial.avatarGradient}`,
      );
    }
  });

  it("renders the social proof line with decorative overlapping avatars", () => {
    const { container } = render(
      <HomepageTestimonialsSocialProofSection isActive motionEnabled />,
    );

    expect(screen.getByText(SOCIAL_PROOF_COPY)).toBeInTheDocument();
    expect(screen.getByLabelText(SOCIAL_PROOF_COPY)).toHaveClass(
      "hp-social-proof",
    );
    expect(
      container.querySelectorAll(
        ".hp-social-proof__avatar:not(.hp-social-proof__avatar--count)",
      ),
    ).toHaveLength(SOCIAL_PROOF_AVATARS.length);
    expect(screen.getByText(SOCIAL_PROOF_COUNT.label)).toBeInTheDocument();
  });

  it("provides mobile snap carousel metadata and dot controls", () => {
    render(<HomepageTestimonialsSocialProofSection isActive motionEnabled />);

    expect(screen.getByLabelText(TESTIMONIAL_CARDS_LABEL)).toHaveAttribute(
      "data-homepage-gesture-lock",
      "true",
    );

    const dots = within(
      screen.getByLabelText(TESTIMONIAL_DOTS_LABEL),
    ).getAllByRole("button");

    expect(dots).toHaveLength(TESTIMONIALS.length);
    expect(dots[0]).toHaveAttribute("data-active", "true");

    fireEvent.click(dots[1]);

    expect(dots[1]).toHaveAttribute("data-active", "true");
    expect(dots[1]).toHaveAttribute("aria-pressed", "true");
  });

  it("marks fallback mode for static cards without glass blur or hover motion", () => {
    render(
      <HomepageTestimonialsSocialProofSection isActive motionEnabled={false} />,
    );

    expect(
      screen.getByTestId("homepage-testimonials-social-proof"),
    ).toHaveAttribute("data-motion-enabled", "false");
  });
});
