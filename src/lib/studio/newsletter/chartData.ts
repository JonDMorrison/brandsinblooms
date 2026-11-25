// The Chart block's data box. The text a person types (or pastes from a
// spreadsheet) is kept exactly as typed in `chartDataText`; the chart reads
// the parsed points in `chartData`. Parsing never writes back into the box.
import type { ChartPoint } from "../../../types/newsletterDesign.ts";

export const CHART_MAX_POINTS = 20;

function parseValue(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (!/\d/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

/**
 * One point per line: "Label, value" or a pasted spreadsheet row
 * "Label<TAB>value". Lines without a number yet (still being typed) are
 * left out of the chart, not turned into zeros.
 */
export function parseChartDataText(text: string): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const tab = line.indexOf("\t");
    const comma = line.lastIndexOf(",");
    const split = tab >= 0 ? tab : comma;
    if (split < 0) continue;
    const label = line.slice(0, split).trim();
    const value = parseValue(tab >= 0 ? line.slice(tab + 1).split("\t")[0] : line.slice(comma + 1));
    if (!label || value === null) continue;
    points.push({ label, value });
    if (points.length >= CHART_MAX_POINTS) break;
  }
  return points;
}

/** The box's text: what was typed, or (older blocks) the saved points. */
export function chartDataTextFor(block: { chartDataText?: unknown; chartData?: ChartPoint[] }): string {
  if (typeof block.chartDataText === "string") return block.chartDataText;
  return (block.chartData ?? []).map((point) => `${point.label}, ${point.value}`).join("\n");
}
