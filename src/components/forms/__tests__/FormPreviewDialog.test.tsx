import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_FORM_COMPLIANCE,
  DEFAULT_FORM_SETTINGS,
} from "@/types/formBuilder";

import { FormPreviewDialog } from "../preview/FormPreviewDialog";

describe("FormPreviewDialog", () => {
  it("renders file fields with the upload control instead of a plain text input", () => {
    render(
      <FormPreviewDialog
        open={true}
        onOpenChange={() => {}}
        formName="Portfolio Intake"
        uploadEmbedKey="9509bb8470ede66441611238b5c068fc"
        settings={DEFAULT_FORM_SETTINGS}
        compliance={DEFAULT_FORM_COMPLIANCE}
        fields={[
          {
            id: "portfolio-files",
            type: "file",
            label: "Upload Portfolio Files",
            required: true,
            mapping_key: "file_portfolio",
            rules: {
              max_files: 2,
              max_file_size_mb: 10,
              allowed_mime_types: ["image/*", "application/pdf"],
            },
          },
        ]}
      />,
    );

    expect(screen.getByText(/upload up to 2 files/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /choose files/i }),
    ).toBeInTheDocument();

    const fileInput = document.body.querySelector(
      'input#portfolio-files[type="file"]',
    );
    const textInput = document.body.querySelector(
      'input#portfolio-files[type="text"]',
    );

    expect(fileInput).toBeInTheDocument();
    expect(textInput).not.toBeInTheDocument();
  });
});
