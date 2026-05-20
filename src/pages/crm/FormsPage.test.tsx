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
});
