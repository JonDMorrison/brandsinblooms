import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_FORM_AUDIENCE,
  DEFAULT_FORM_COMPLIANCE,
  DEFAULT_FORM_SETTINGS,
  type FormWithStats,
} from "@/types/formBuilder";

const useFormsMock = vi.fn();

vi.mock("@/hooks/useForms", () => ({
  useForms: () => useFormsMock(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock("@/components/forms/FormTemplatesDialog", () => ({
  FormTemplatesDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="templates-dialog" /> : null,
}));

vi.mock("@/components/forms/preview/FormPreviewDialog", () => ({
  FormPreviewDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="preview-dialog" /> : null,
}));

import FormsPage from "./FormsPage";

function buildForm(overrides: Partial<FormWithStats> = {}): FormWithStats {
  return {
    id: "form-1",
    tenant_id: "tenant-1",
    name: "Sample Form",
    status: "draft",
    fields_json: [],
    settings_json: DEFAULT_FORM_SETTINGS,
    compliance_json: DEFAULT_FORM_COMPLIANCE,
    audience_json: DEFAULT_FORM_AUDIENCE,
    embed_key: "abc123",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    total_submissions: 0,
    recent_submissions: 0,
    recent_accepted: 0,
    recent_rejected: 0,
    last_submission_at: null,
    ...overrides,
  };
}

function setUseFormsState(state: {
  forms: FormWithStats[];
  isLoading?: boolean;
  error?: unknown;
}) {
  useFormsMock.mockReturnValue({
    forms: state.forms,
    isLoading: state.isLoading ?? false,
    error: state.error ?? null,
    refetchForms: vi.fn(),
    createForm: vi.fn(),
    updateForm: vi.fn(),
    deleteForm: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/crm/forms"]}>
      <FormsPage />
    </MemoryRouter>,
  );
}

describe("FormsPage — resilience to empty data", () => {
  it("renders the empty state without throwing when the forms list is empty", () => {
    setUseFormsState({ forms: [] });
    renderPage();
    expect(screen.getByText("No forms yet")).toBeInTheDocument();
  });

  it("renders a draft form whose fields_json is an empty array without throwing", () => {
    setUseFormsState({
      forms: [
        buildForm({
          id: "draft-empty",
          name: "Untitled Form",
          fields_json: [],
        }),
      ],
    });
    renderPage();
    expect(screen.getAllByText("Untitled Form").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Draft — no fields yet/).length).toBeGreaterThan(
      0,
    );
  });

  it("renders skeletons without throwing in the loading state", () => {
    setUseFormsState({ forms: [], isLoading: true });
    const { container } = renderPage();
    expect(container).toBeTruthy();
    expect(screen.queryByText("No forms yet")).not.toBeInTheDocument();
  });

  // Jeff at Brands in Blooms (tenant 0a626809-3f46-45d8-b325-55de9c4ba576)
  // hit the App-level error fallback on /crm/forms (incident MQGT8U01-STKT,
  // 2026-06-16T15:42:10Z). Pinning the exact RPC payload his forms list
  // returned, so any future change that breaks this specific data shape
  // — a published form with `audience_json: {}` (empty object, not null
  // and not the typed default) and a mix of text / email / email_consent
  // field types — fails the build instead of taking out the route.
  it("renders Jeff's exact get_forms_with_stats payload without throwing", () => {
    const jeffForm = {
      id: "afb1bfeb-56a2-4965-8b76-12db509b85d8",
      tenant_id: "0a626809-3f46-45d8-b325-55de9c4ba576",
      name: "Newsletter Signup",
      status: "published" as const,
      embed_key: "0bc030f11c63364a227294c268022fdf",
      created_at: "2026-01-30T19:18:48.156151+00:00",
      updated_at: "2026-02-03T22:30:52.038961+00:00",
      fields_json: [
        {
          id: "dac3ce46-ebe1-4e75-be17-12fa9b830584",
          type: "text",
          label: "New text field",
          required: false,
          mapping_key: "custom",
          placeholder: "Enter your answer...",
        },
        {
          id: "0e4b3ba5-abb2-42ea-a9d1-97dc3dc8e95f",
          type: "email",
          label: "Email Address",
          required: true,
          mapping_key: "email",
          placeholder: "you@example.com",
        },
        {
          id: "8cd1b172-261c-4055-b398-a94266e44a92",
          type: "text",
          label: "First Name",
          required: false,
          mapping_key: "first_name",
          placeholder: "Your first name",
        },
        {
          id: "4fb58a5f-bd62-4709-a71c-b6684a6b3bcb",
          type: "email_consent",
          label: "Email Consent",
          required: true,
          mapping_key: "email_consent",
        },
      ],
      settings_json: {
        theme: {
          spacing: "normal",
          font_family: "inherit",
          button_style: "filled",
          border_radius: "8px",
          primary_color: "#41a9be",
        },
        form_headline: "Testing This Headline",
        show_branding: true,
        success_message: "Thanks for subscribing!",
        form_subheadline: "Sign up here.",
        submit_button_text: "Subscribe",
        notification_emails: [],
        success_redirect_url: null,
      },
      compliance_json: {
        double_opt_in: false,
        gdpr_compliant: false,
        sms_consent_text: "I agree to receive SMS messages",
        email_consent_text: "I agree to receive marketing emails.",
        sms_consent_required: false,
        email_consent_required: true,
      },
      // Jeff's actual shape — a bare empty object, not the typed default.
      audience_json: {},
      total_submissions: 0,
      recent_submissions: 0,
      recent_accepted: 0,
      recent_rejected: 0,
      last_submission_at: null,
    } as unknown as FormWithStats;

    setUseFormsState({ forms: [jeffForm] });
    renderPage();
    expect(screen.getAllByText("Newsletter Signup").length).toBeGreaterThan(0);
  });
});
