import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { getCanonicalFormDocumentationPath } from "@/lib/forms/documentation";

import { FormPublishTab } from "../FormPublishTab";

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
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

    expect(screen.getByText(/your form link/i)).toBeInTheDocument();
    expect(screen.getByTestId("public-link-display")).toHaveTextContent(
      /9509bb84\.\.\.068fc/i,
    );
    expect(screen.getByRole("link", { name: /email/i })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:?subject=Check%20out%20this%20form"),
    );
    expect(
      screen.getByRole("button", { name: /copy social share message/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /show qr code/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /copy public form link/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Copied" }),
    );
  });

  it("copies the social share message and expands the QR preview", async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(
      screen.getByRole("button", { name: /copy social share message/i }),
    );

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Copied" }),
      );
    });

    await user.click(screen.getByRole("button", { name: /show qr code/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /download png/i }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /download svg/i }),
    ).toBeInTheDocument();
  });

  it("updates the embed code when the display style and button text change", async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole("tab", { name: /embed code/i }));
    await user.click(screen.getByRole("button", { name: /modal/i }));
    const buttonTextInput = screen.getByLabelText(/button text/i);
    await user.clear(buttonTextInput);
    await user.type(buttonTextInput, "Book now");

    const codeBlock = screen.getByTestId("embed-code-block");
    expect(codeBlock).toHaveTextContent('data-display-mode="modal"');
    expect(codeBlock).toHaveTextContent('data-button-text="Book now"');
  });

  it("shows developer tools with a docs link and quick-copy snippets", async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(
      screen.getByRole("tab", { name: /developer integration/i }),
    );

    const docsLink = screen.getByRole("link", {
      name: /open full developer documentation/i,
    });
    expect(docsLink).toHaveAttribute(
      "href",
      getCanonicalFormDocumentationPath(form.id),
    );

    await user.click(screen.getByRole("tab", { name: /^cURL/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /copy cURL starter/i }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /copy cURL starter/i }),
    );

    expect(
      screen.getByText(/copy as markdown for ai coding agents/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/for ai training & integration purposes/i),
    ).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Copied" }),
    );
  });
});
