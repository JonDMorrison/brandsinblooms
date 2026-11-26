import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { getCanonicalFormDocumentationPath } from "@/lib/forms/documentation";

import { BLOOMSITES_GROWTH_URL, FormPublishTab } from "../FormPublishTab";

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: mockToast,
  },
}));

describe("FormPublishTab", () => {
  beforeEach(() => {
    mockToast.mockReset();
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = vi.fn(() => true);
  });

  const form = {
    compliance_json: {
      email_consent_required: false,
      email_consent_text: "",
      sms_consent_required: false,
      sms_consent_text: "",
      double_opt_in: false,
      gdpr_compliant: false,
    },
    embed_key: "9509bb8470ede66441611238b5c068fc",
    fields_json: [
      {
        id: "email-field",
        type: "email",
        label: "Email Address",
        required: true,
        mapping_key: "email",
        placeholder: "you@example.com",
        step_index: 0,
      },
    ],
    id: "form_123",
    name: "VIP Signup",
    settings_json: {
      form_title: "VIP Signup",
      form_description: "Join the list",
      success_message: "Thanks for signing up!",
      success_redirect_url: null,
      submit_button_text: "Join Now",
      show_branding: true,
      theme: {},
      notification_emails: [],
      steps: [{ index: 0, title: "Welcome", description: "Main step" }],
    },
    status: "published" as const,
    tenant_id: "tenant_123",
  };

  function renderComponent(overrides: Partial<typeof form> = {}) {
    return render(
      <MemoryRouter>
        <FormPublishTab form={{ ...form, ...overrides }} />
      </MemoryRouter>,
    );
  }

  it("leads with BloomSites guidance and copies the embed key", async () => {
    const user = userEvent.setup();
    renderComponent();

    const card = await screen.findByTestId("form-publish-bloomsites-card");
    expect(card).toHaveTextContent("Show it on your BloomSites website");
    expect(screen.getByLabelText("Form embed key")).toHaveValue(form.embed_key);
    expect(
      screen.getByRole("link", { name: /open grow your audience in bloomsites/i }),
    ).toHaveAttribute("href", BLOOMSITES_GROWTH_URL);

    // The BloomSites card renders before every other share option.
    const directLink = screen.getByText("Direct link");
    expect(
      card.compareDocumentPosition(directLink) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /copy embed key/i }));

    expect(mockToast).toHaveBeenCalledWith("Embed key copied");
  });

  it("tells the user to publish first when the form is a draft", async () => {
    renderComponent({ status: "draft" });

    expect(
      await screen.findByText(/publish this form first/i),
    ).toBeInTheDocument();
  });

  it("opens the canvas with this form selected for a welcome automation", async () => {
    renderComponent();
    expect(await screen.findByRole("link", { name: "Create welcome automation" }))
      .toHaveAttribute("href", `/crm/automations/new/canvas?form=${encodeURIComponent(form.id)}`);
  });

  it("shows the redesigned Share Link surface and copies the public link", async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(await screen.findByText(/other ways to share/i)).toBeInTheDocument();
    expect(screen.getByText("Direct link")).toBeInTheDocument();
    expect(screen.getByText("QR code")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /copy link/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/Copied/)).toBeInTheDocument();
    });
    expect(mockToast).toHaveBeenCalledWith("Link copied");
  });

  it("renders QR download and copy actions", async () => {
    renderComponent();

    expect(
      await screen.findByRole("button", { name: /download qr/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy qr/i }),
    ).toBeInTheDocument();
  });

  it("updates the embed code when the display style and button text change", async () => {
    const user = userEvent.setup();
    renderComponent();

    await screen.findByText("JavaScript embed");
    await user.click(screen.getByRole("combobox", { name: /display mode/i }));
    await user.click(screen.getByRole("option", { name: /modal/i }));
    const buttonTextInput = screen.getByLabelText(/button label/i);
    await user.clear(buttonTextInput);
    await user.type(buttonTextInput, "Book now");

    const codeBlock = screen.getAllByText(/data-display-mode=/i)[0];
    expect(codeBlock).toHaveTextContent('data-display-mode="modal"');
    expect(codeBlock).toHaveTextContent('data-button-text="Book now"');
  });

  it("keeps developer tools collapsed until opened, then shows docs and snippets", async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(await screen.findByText(/developer options/i)).toBeInTheDocument();
    expect(screen.queryByText("cURL")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /developer options/i }));

    const docsLink = screen.getByRole("link", {
      name: /view full api docs/i,
    });
    expect(docsLink).toHaveAttribute(
      "href",
      getCanonicalFormDocumentationPath(form.id),
    );

    await user.click(
      screen.getByRole("button", { name: /copy cURL/i }),
    );

    expect(
      screen.getByText("API endpoint"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Server-side submission bypasses browser CORS/i),
    ).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith("cURL snippet copied");
  });
});
