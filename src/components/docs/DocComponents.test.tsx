import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Store } from "lucide-react";
import { createRef } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DocCallout } from "@/components/docs/DocCallout";
import { DocCodeBlock } from "@/components/docs/DocCodeBlock";
import { DocFieldTable } from "@/components/docs/DocFieldTable";
import { DocHeader } from "@/components/docs/DocHeader";
import { DocInlineCode } from "@/components/docs/DocInlineCode";
import { DocScrollProgress } from "@/components/docs/DocScrollProgress";
import { DocSection } from "@/components/docs/DocSection";
import { DocShell } from "@/components/docs/DocShell";
import { DocSidebar } from "@/components/docs/DocSidebar";
import { DocStep } from "@/components/docs/DocStep";

describe("docs components", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    });
  });

  it("renders the shared docs primitives in isolation", async () => {
    const user = userEvent.setup();
    const contentRef = createRef<HTMLElement>();

    const { container } = render(
      <MemoryRouter>
        <DocShell
          sidebar={
            <DocSidebar
              integrationName="Square"
              integrationSlug="square"
              branding={{ icon: Store }}
              sections={[
                {
                  id: "overview",
                  title: "Overview",
                  group: "Intro",
                  content: <p>Overview body</p>,
                },
                {
                  id: "setup",
                  title: "Setup",
                  group: "Setup",
                  content: <p>Setup body</p>,
                },
              ]}
            />
          }
        >
          <main ref={contentRef}>
            <DocScrollProgress targetRef={contentRef} />
            <DocHeader
              integrationName="Square"
              category="POS Systems"
              pageTitle="Square Integration Guide"
              overview="Overview copy"
              lastUpdated="Mar 23, 2026"
              readingTimeMinutes={6}
              branding={{ icon: Store }}
            />
            <DocSection id="overview" title="Overview">
              <DocInlineCode>square</DocInlineCode>
            </DocSection>
            <DocSection id="setup" title="Setup">
              <DocCallout variant="info" title="Info">
                Info state
              </DocCallout>
              <DocCallout variant="warning" title="Warning">
                Warning state
              </DocCallout>
              <DocCallout variant="success" title="Success">
                Success state
              </DocCallout>
              <DocCallout variant="danger" title="Danger">
                Danger state
              </DocCallout>
              <DocStep stepNumber={1} stepTitle="First step">
                Step body
              </DocStep>
              <DocStep stepNumber={2} stepTitle="Second step" isLast>
                Final step body
              </DocStep>
              <DocCodeBlock language="bash" code="echo hello" />
              <DocFieldTable
                fields={[
                  {
                    name: "client_id",
                    description: "Provider app id",
                    required: true,
                  },
                  {
                    name: "environment",
                    description: "Sandbox or production",
                    required: false,
                  },
                ]}
              />
            </DocSection>
          </main>
        </DocShell>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Square Integration Guide" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to square/i }),
    ).toHaveAttribute("href", "/integrations/square");
    expect(screen.getByText("Info state")).toBeInTheDocument();
    expect(screen.getByText("Warning state")).toBeInTheDocument();
    expect(screen.getByText("Success state")).toBeInTheDocument();
    expect(screen.getByText("Danger state")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Required" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Required").length).toBeGreaterThan(1);
    expect(screen.getByText("Optional")).toBeInTheDocument();
    expect(container.querySelector(".bg-emerald-500")).not.toBeNull();

    await user.click(
      screen.getByRole("button", { name: /copy bash code block/i }),
    );
    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});
