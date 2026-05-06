import { render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { NanoLeafParticles } from "./NanoLeafParticles";

describe("NanoLeafParticles", () => {
  it("renders the requested capped particle count on canvas", () => {
    const { container } = render(
      <NanoLeafParticles tier="medium" densityMultiplier={0.4} tint="sage" />,
    );

    expect(container.querySelector("canvas")).toHaveAttribute(
      "data-particle-count",
      "60",
    );
  });

  it("renders no canvas on fallback tier", () => {
    const { container } = render(
      <NanoLeafParticles tier="fallback" densityMultiplier={1} tint="bright" />,
    );

    expect(container.querySelector("canvas")).toBeNull();
  });
});
