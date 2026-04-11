import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraggableFieldList } from "@/components/forms/DraggableFieldList";
import { FormDesignTab } from "@/components/forms/FormDesignTab";
import {
  DEFAULT_FORM_SETTINGS,
  FormCompliance,
  FormField,
  FormSettings,
} from "@/types/formBuilder";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useBrandColors", () => ({
  useBrandColors: () => ({ data: null }),
}));

const baseField: FormField = {
  id: "field-1",
  label: "First Name",
  mapping_key: "first_name",
  required: false,
  type: "text",
};

const baseSettings: FormSettings = {
  notification_emails: [],
  show_branding: true,
  submit_button_text: "Submit",
  success_message: "Thanks",
  theme: {},
};

const baseCompliance: FormCompliance = {
  double_opt_in: false,
  email_consent_required: false,
  email_consent_text: "",
  gdpr_compliant: false,
  sms_consent_required: false,
  sms_consent_text: "",
};

function StatefulDraggableFieldList({
  initialFields = [baseField],
  initialSettings = baseSettings,
}: {
  initialFields?: FormField[];
  initialSettings?: FormSettings;
}) {
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [settings, setSettings] = useState<FormSettings>(initialSettings);

  return (
    <DraggableFieldList
      compliance={baseCompliance}
      fields={fields}
      focusedStepIndex={0}
      onFocusedStepIndexChange={vi.fn()}
      settings={settings}
      updateCompliance={vi.fn()}
      updateFields={setFields}
      updateSettings={setSettings}
    />
  );
}

function StatefulFormDesignTab({
  initialSettings = DEFAULT_FORM_SETTINGS,
}: {
  initialSettings?: FormSettings;
}) {
  const [settings, setSettings] = useState<FormSettings>(initialSettings);

  return <FormDesignTab settings={settings} onSettingsChange={setSettings} />;
}

describe("DraggableFieldList insertion triggers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        addEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: "(max-width: 767px)",
        onchange: null,
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("opens the field picker from the top insertion trigger", async () => {
    const user = userEvent.setup();

    render(
      <DraggableFieldList
        compliance={baseCompliance}
        fields={[baseField]}
        focusedStepIndex={0}
        onFocusedStepIndexChange={vi.fn()}
        settings={baseSettings}
        updateCompliance={vi.fn()}
        updateFields={vi.fn()}
        updateSettings={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Add a field above First Name"));

    expect(await screen.findByText("Basic Fields")).toBeVisible();
    expect(screen.getAllByText("Text Input").length).toBeGreaterThan(0);
  });

  it("opens the field picker from the bottom insertion trigger", async () => {
    const user = userEvent.setup();

    render(
      <DraggableFieldList
        compliance={baseCompliance}
        fields={[baseField]}
        focusedStepIndex={0}
        onFocusedStepIndexChange={vi.fn()}
        settings={baseSettings}
        updateCompliance={vi.fn()}
        updateFields={vi.fn()}
        updateSettings={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Add a field below First Name"));

    expect(await screen.findByText("Basic Fields")).toBeVisible();
    expect(screen.getAllByText("Text Input").length).toBeGreaterThan(0);
  });

  it("opens a field configuration without crashing the validation rules editor", async () => {
    const user = userEvent.setup();

    render(
      <DraggableFieldList
        compliance={baseCompliance}
        fields={[baseField]}
        focusedStepIndex={0}
        onFocusedStepIndexChange={vi.fn()}
        settings={baseSettings}
        updateCompliance={vi.fn()}
        updateFields={vi.fn()}
        updateSettings={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Expand field"));

    expect(await screen.findByText("Validation Rules")).toBeVisible();
    expect(screen.getByText("Custom Regex Pattern")).toBeVisible();
  });

  it("preserves trailing spaces in the step title until blur and restores the default only after blur", async () => {
    const user = userEvent.setup();

    render(
      <StatefulDraggableFieldList
        initialSettings={{
          ...baseSettings,
          steps: [{ index: 0, title: "Step 1", description: "" }],
        }}
      />,
    );

    const input = screen.getByLabelText("Step Title");

    await user.click(input);
    await user.type(input, " ");

    expect(input).toHaveValue("Step 1 ");

    input.setSelectionRange(4, 4);
    await user.keyboard(" ");

    expect(input).toHaveValue("Step  1 ");

    await user.clear(input);

    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Step 1");

    await user.tab();

    expect(input).toHaveValue("Step 1");
  });

  it("trims step titles on blur after allowing raw whitespace while editing", async () => {
    const user = userEvent.setup();

    render(
      <StatefulDraggableFieldList
        initialSettings={{
          ...baseSettings,
          steps: [{ index: 0, title: "Step 1", description: "" }],
        }}
      />,
    );

    const input = screen.getByLabelText("Step Title");

    await user.clear(input);
    await user.type(input, "  Launch Plan  ");

    expect(input).toHaveValue("  Launch Plan  ");

    await user.tab();

    expect(input).toHaveValue("Launch Plan");
  });

  it("lets option labels keep raw spaces while focused and trims on blur", async () => {
    const user = userEvent.setup();

    render(
      <StatefulDraggableFieldList
        initialFields={[
          {
            ...baseField,
            id: "field-select",
            label: "Interests",
            mapping_key: "interests",
            options: ["Option 1"],
            type: "select",
          },
        ]}
      />,
    );

    await user.click(screen.getByLabelText("Expand field"));

    const optionInput = screen.getByDisplayValue("Option 1");

    await user.click(optionInput);
    await user.type(optionInput, " ");

    expect(optionInput).toHaveValue("Option 1 ");

    await user.tab();

    expect(optionInput).toHaveValue("Option 1");
  });
});

describe("FormDesignTab behavior fields", () => {
  it("keeps submit button text empty while focused and restores the default on blur", async () => {
    const user = userEvent.setup();

    render(<StatefulFormDesignTab />);

    const input = screen.getByLabelText("Submit Button Text");

    await user.clear(input);

    expect(input).toHaveValue("");

    await user.tab();

    expect(input).toHaveValue(DEFAULT_FORM_SETTINGS.submit_button_text);
  });

  it("lets the redirect url keep trailing spaces while focused and trims on blur", async () => {
    const user = userEvent.setup();

    render(<StatefulFormDesignTab />);

    const input = screen.getByLabelText("Redirect URL");

    await user.type(input, "https://example.com/thank-you ");

    expect(input).toHaveValue("https://example.com/thank-you ");

    await user.tab();

    expect(input).toHaveValue("https://example.com/thank-you");
  });
});
