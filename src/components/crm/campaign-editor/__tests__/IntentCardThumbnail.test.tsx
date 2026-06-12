import "@testing-library/jest-dom/vitest";

import * as React from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { IntentCardThumbnail } from "@/components/crm/campaign-editor/IntentCardThumbnail";
import {
  CAMPAIGN_TEMPLATES,
  getTemplateForIntent,
} from "@/lib/studio/campaignTemplates";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const inJoy = (ui: React.ReactElement) =>
  render(<CssVarsProvider>{ui}</CssVarsProvider>);

describe("IntentCardThumbnail", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the blank variant with a placeholder mark", () => {
    inJoy(<IntentCardThumbnail template={null} variant="blank" />);
    expect(screen.getByText("+")).toBeInTheDocument();
  });

  it("renders a coming-soon empty state when no template matches an intent", () => {
    inJoy(
      <IntentCardThumbnail template={null} emptyLabel="Coming soon" />,
    );
    expect(screen.getByTestId("intent-thumbnail-empty")).toHaveTextContent(
      "Coming soon",
    );
  });

  it("renders a wireframe preview for the first campaign template", () => {
    const template = CAMPAIGN_TEMPLATES[0];
    inJoy(<IntentCardThumbnail template={template} />);
    expect(
      screen.getByTestId(`intent-thumbnail-${template.id}`),
    ).toBeInTheDocument();
  });

  it("produces at least one rendered row for every known campaign template", () => {
    // Guard against a future template adding a new `kind` value that the
    // wireframe mapper doesn't recognise. If this fails, add the missing kind
    // to thumbnailBlockToRow.
    for (const template of CAMPAIGN_TEMPLATES) {
      cleanup();
      inJoy(<IntentCardThumbnail template={template} />);
      const wireframe = screen.getByTestId(
        `intent-thumbnail-${template.id}`,
      );
      expect(wireframe.children.length).toBeGreaterThan(0);
    }
  });

  it("can resolve a template for every non-blank built-in intent", () => {
    // Guards the IntentPicker against the case where someone retags a
    // template and breaks intent → template resolution silently.
    const intents = ["newsletter", "sale", "new-arrivals", "event", "thank-you"] as const;
    for (const intent of intents) {
      const template = getTemplateForIntent(intent);
      expect(template, `no template for intent ${intent}`).not.toBeNull();
    }
  });
});
