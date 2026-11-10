import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { getCanonicalFormDocumentationPath } from "@/lib/forms/documentation";

import { FormPublishTab } from "../FormPublishTab";

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
    status: "published",
    tenant_id: "tenant_123",
  };

  function renderComponent() {
    return render(
      <MemoryRouter>
        <FormPublishTab form={form} />
      </MemoryRouter>,
    );
  }

  it("shows the redesigned Share Link surface and copies the public link", async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(await screen.findByText(/share your form/i)).toBeInTheDocument();
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

  it("shows developer tools with a docs link and quick-copy snippets", async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(await screen.findByText(/developer integration/i)).toBeInTheDocument();

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
      screen.getByText(/API endpoint/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Server-side submission bypasses browser CORS/i),
    ).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith("cURL snippet copied");
  });
});
