import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormPreviewRenderer } from "../preview/FormPreviewRenderer";
import { DEFAULT_FORM_SETTINGS, DEFAULT_FORM_COMPLIANCE } from "@/types/formBuilder";
import { getSpacingValue } from "@/lib/forms/designSettings";

describe("form field spacing", () => {
  it("updates vertical spacing in the shared public and editor renderer", () => {
    const fields = [{ id: "name", type: "text" as const, label: "Name", mapping_key: "name", required: false }];
    const props = { fields, compliance: DEFAULT_FORM_COMPLIANCE };
    const { container, rerender } = render(<FormPreviewRenderer {...props} settings={{...DEFAULT_FORM_SETTINGS, theme: {...DEFAULT_FORM_SETTINGS.theme, spacing: "compact"}}} />);
    const grid = () => Array.from(container.querySelectorAll("div")).find(el => el.style.gridTemplateColumns && el.style.rowGap);
    expect(grid()?.style.rowGap).toBe(getSpacingValue("compact"));
    rerender(<FormPreviewRenderer {...props} settings={{...DEFAULT_FORM_SETTINGS, theme: {...DEFAULT_FORM_SETTINGS.theme, spacing: "relaxed"}}} />);
    expect(grid()?.style.rowGap).toBe(getSpacingValue("relaxed"));
  });
});
