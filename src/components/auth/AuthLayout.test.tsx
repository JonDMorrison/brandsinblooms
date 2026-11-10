import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { AuthLayout } from "./AuthLayout";

describe("AuthLayout brand", () => {
  afterEach(cleanup);

  it("uses the canonical BloomSuite logo asset", () => {
    const { container } = render(
      <MemoryRouter>
        <AuthLayout>Onboarding content</AuthLayout>
      </MemoryRouter>,
    );

    const brand = screen.getByRole("link", { name: "BloomSuite home" });
    const logo = brand.querySelector<HTMLImageElement>(
      "img.auth-layout__logo",
    );

    expect(logo).toBeInTheDocument();
    expect(logo?.src).toContain("bloomsuite-logo-correct");
    expect(brand.querySelector("svg.auth-layout__logo")).toBeNull();
    expect(container).toHaveTextContent("Onboarding content");
  });
});
