import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FormDocumentationPage from "../FormDocumentationPage";

const mockToast = vi.fn();
const mockUseTenant = vi.fn();
const mockUseForm = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => mockUseTenant(),
}));

vi.mock("@/hooks/useForms", () => ({
  useForm: (...args: unknown[]) => mockUseForm(...args),
}));

const form = {
  id: "form_123",
  tenant_id: "tenant_123",
  name: "VIP Signup",
  status: "published",
  embed_key: "0123456789abcdef0123456789abcdef",
  created_at: "2026-04-01T12:00:00.000Z",
  updated_at: "2026-04-12T12:00:00.000Z",
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
    {
      id: "favorite-bloom-field",
      type: "text",
      label: "Favorite Bloom",
      required: false,
      mapping_key: "custom",
      placeholder: "Ranunculus",
      step_index: 0,
    },
  ],
  settings_json: {
    form_title: "VIP Signup",
    form_description: "Join the list",
    success_message: "Thanks for signing up!",
    success_redirect_url: "https://example.com/thanks",
    submit_button_text: "Join Now",
    show_branding: true,
    theme: {},
    notification_emails: [],
    steps: [{ index: 0, title: "Welcome", description: "Main capture step" }],
  },
  compliance_json: {
    email_consent_required: false,
    email_consent_text: "",
    sms_consent_required: false,
    sms_consent_text: "",
    double_opt_in: false,
    gdpr_compliant: false,
  },
};

describe("FormDocumentationPage", () => {
  beforeEach(() => {
    mockToast.mockReset();
    mockUseTenant.mockReturnValue({
      tenant: { id: "tenant_123" },
      loading: false,
      error: null,
    });
    mockUseForm.mockReturnValue({
      data: form,
      isLoading: false,
      error: null,
    });

    class MockIntersectionObserver {
      observe() {}
      disconnect() {}
      unobserve() {}
    }

    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver,
    });
  });

  it("renders the redesigned developer reference header and metadata", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/dashboard/forms/form_123/docs"]}>
          <Routes>
            <Route
              path="/dashboard/forms/:formId/docs"
              element={<FormDocumentationPage />}
            />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "VIP Signup", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/developer integration reference/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to form editor/i }),
    ).toHaveAttribute("href", "/crm/forms/form_123");
    expect(screen.getAllByText("email").length).toBeGreaterThan(0);
    expect(screen.getByText("favorite-bloom-field")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open public form/i }),
    ).toHaveAttribute(
      "href",
      "http://localhost:3000/f/0123456789abcdef0123456789abcdef",
    );
    expect(
      screen.getByRole("button", { name: /copy docs as markdown/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /copy ai markdown/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy for ai agents/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^form id$/i)).toBeInTheDocument();
    expect(screen.getByText(/^api endpoint$/i)).toBeInTheDocument();
    expect(screen.getByText(/^embed key$/i)).toBeInTheDocument();
    expect(screen.getByText(/^schema$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/post \/api\/forms\/form_123\/submit/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/2 fields · 1 step/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^published$/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByText(/for ai training & integration purposes/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/form builder/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/live contract/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/canonical route/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        document.head.querySelector('link[rel="canonical"]'),
      ).toHaveAttribute(
        "href",
        "http://localhost:3000/dashboard/forms/form_123/docs",
      );
    });
  });

  it("moves the file upload implementation note out of the header and into the payload area", () => {
    mockUseForm.mockReturnValue({
      data: {
        ...form,
        fields_json: [
          ...form.fields_json,
          {
            id: "upload-field",
            type: "file",
            label: "Upload Brief",
            required: false,
            mapping_key: "files",
            step_index: 0,
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/dashboard/forms/form_123/docs"]}>
          <Routes>
            <Route
              path="/dashboard/forms/:formId/docs"
              element={<FormDocumentationPage />}
            />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(
      screen.getByText(/file uploads use references/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/this form includes file uploads/i),
    ).not.toBeInTheDocument();
  });

  it("shows the empty-form guidance when no fields are configured", () => {
    mockUseForm.mockReturnValue({
      data: {
        ...form,
        fields_json: [],
        status: "draft",
      },
      isLoading: false,
      error: null,
    });

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/dashboard/forms/form_123/docs"]}>
          <Routes>
            <Route
              path="/dashboard/forms/:formId/docs"
              element={<FormDocumentationPage />}
            />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(screen.getByText(/this form is still empty/i)).toBeInTheDocument();
    expect(screen.getByText(/no fields to document yet/i)).toBeInTheDocument();
  });
});
