import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ExtendedBlockProperties from "./ExtendedBlockProperties";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { renderExtendedBlock } from "@/lib/studio/newsletter/renderExtensions";
import { parseChartDataText } from "@/lib/studio/newsletter/chartData";
import type { StudioBlock } from "@/types/studioBlocks";

vi.mock("./NewsletterDesignContext", () => ({
  useNewsletterDesign: () => ({ settings: {} }),
}));

function Harness({ onBlock }: { onBlock: (block: StudioBlock) => void }) {
  const [block, setBlock] = React.useState<StudioBlock>(createStudioBlock("chart"));
  onBlock(block);
  return (
    <ExtendedBlockProperties
      block={block}
      update={(field, value) => setBlock((current) => ({ ...current, [field]: value }))}
    />
  );
}

const field = () => screen.getByLabelText("Chart data: label, value (one per line)") as HTMLTextAreaElement;

/** Types one character at a time, the way a person does. */
function typeInto(text: string) {
  for (const char of text) fireEvent.change(field(), { target: { value: field().value + char } });
}

describe("Chart data field", () => {
  it("keeps the text exactly as typed while the chart reads the parsed rows", () => {
    let latest = createStudioBlock("chart");
    render(<Harness onBlock={(block) => { latest = block; }} />);
    typeInto("Pruning, 24\nWreaths, 41");
    expect(field().value).toBe("Pruning, 24\nWreaths, 41");
    expect(latest.chartData).toEqual([
      { label: "Pruning", value: 24 },
      { label: "Wreaths", value: 41 },
    ]);
    const html = renderExtendedBlock(latest, 640) ?? "";
    expect(html).toContain("Pruning");
    expect(html).toContain("Wreaths");
  });

  it("does not turn a half-typed label into 'R, 0'", () => {
    render(<Harness onBlock={() => undefined} />);
    typeInto("Roses");
    expect(field().value).toBe("Roses");
  });

  it("accepts rows pasted from a spreadsheet", () => {
    let latest = createStudioBlock("chart");
    render(<Harness onBlock={(block) => { latest = block; }} />);
    fireEvent.change(field(), { target: { value: "Pruning\t24\nWreaths\t41\n" } });
    expect(field().value).toBe("Pruning\t24\nWreaths\t41\n");
    expect(latest.chartData).toEqual([
      { label: "Pruning", value: 24 },
      { label: "Wreaths", value: 41 },
    ]);
  });

  it("parses labels containing commas and leaves out rows without a number", () => {
    expect(parseChartDataText("Trees, shrubs, 12\nRoses\nBulbs, \n")).toEqual([
      { label: "Trees, shrubs", value: 12 },
    ]);
  });

  it("shows saved points for older blocks that have no typed text", () => {
    const block = { ...createStudioBlock("chart"), chartData: [{ label: "Ferns", value: 7 }] };
    render(<ExtendedBlockProperties block={block} update={() => undefined} />);
    expect(field().value).toBe("Ferns, 7");
  });
});
