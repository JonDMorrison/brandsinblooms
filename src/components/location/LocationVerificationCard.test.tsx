import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocationVerificationCard } from "./LocationVerificationCard";

const renderManualForm = (override: Record<string, unknown> = {}) => {
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  const utils = render(
    <LocationVerificationCard
      onConfirm={onConfirm}
      isLoading={false}
      isSaving={false}
      // Seed a detected location so the manual form is exposed.
      postalCode="97215"
      city="Portland"
      stateProvince="OR"
      country="US"
      needsConfirmation
      {...override}
    />,
  );
  return { ...utils, onConfirm };
};

const pickCountry = async (label: RegExp) => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: /country/i }));
  await user.click(await screen.findByRole("option", { name: label }));
};

describe("LocationVerificationCard country picker (Bug 14)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the Country control as a Select with US and Canada options", () => {
    renderManualForm();

    const countryCombo = screen.getByRole("combobox", { name: /country/i });
    expect(countryCombo).toBeInTheDocument();
    expect(countryCombo).not.toHaveAttribute("aria-disabled", "true");
    expect(countryCombo).toHaveTextContent(/united states/i);
  });

  it("flipping the picker to Canada surfaces a soft warning for a US-shape postal (75000)", async () => {
    renderManualForm({ postalCode: "75000" });

    await pickCountry(/canada/i);

    const matches = await screen.findAllByText(
      /Doesn't look like a Canadian postal code/i,
    );
    expect(matches.length).toBeGreaterThan(0);
  });

  it("flipping the picker to US surfaces a soft warning for a CA-shape postal", async () => {
    renderManualForm({ postalCode: "V6B 1A1", country: "CA" });

    await pickCountry(/united states/i);

    const matches = await screen.findAllByText(/Doesn't look like a US ZIP/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("does NOT block confirm on a soft postal/country mismatch (Lahore 75000 → user picks Canada)", async () => {
    const { onConfirm } = renderManualForm({ postalCode: "75000" });

    await pickCountry(/canada/i);

    const matches = await screen.findAllByText(
      /Doesn't look like a Canadian postal code/i,
    );
    expect(matches.length).toBeGreaterThan(0);

    const confirmButton = screen.getByRole("button", {
      name: /confirm location/i,
    });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        postalCode: "75000",
        country: "CA",
      }),
    );
  });

  it("typing a valid US ZIP keeps country=US and does not surface a warning", () => {
    renderManualForm({ postalCode: "" });

    const postalInput = screen.getByPlaceholderText(/^97215$|^V6B 1A1$/);
    fireEvent.change(postalInput, { target: { value: "97215" } });

    expect(
      screen.queryByText(/Doesn't look like/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /country/i }),
    ).toHaveTextContent(/united states/i);
  });
});
