import { readFileSync } from "node:fs";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  catalogItemMatches,
  mergeCatalogMatches,
  singularQuery,
  textMatchesSearch,
  wordVariants,
} from "../../supabase/functions/_shared/catalogSearch";
import { catalogNoMatchesMessage, type ConnectedContentResponse } from "@/lib/connectedContent";

// The Studio's "Products" image tab and "From my website" picker search the
// connected BloomSites catalogue through the connected-content function.
// Northfield's catalogue lists "Endless Summer® The Original Hydrangea ·
// 3 Gallon"; a search for "hydrangea" must find it.
const HYDRANGEA = {
  id: "a3cdad18-b232-4707-8888-251058aa480c",
  type: "product",
  title: "Endless Summer® The Original Hydrangea · 3 Gallon",
  description: "<p>A small deciduous shrub with mophead flowers.</p>",
  category: "Shrubs",
};
const VIBURNUM = {
  id: "3e8edd44-1701-4ca0-af53-0371a6f57332",
  type: "product",
  title: "Korean Spice Viburnum · 3 Gallon",
  description: "<p>Pairs well with Hydrangea and Sweetspire.</p>",
  category: "Shrubs",
};
const LILY = {
  id: "0b0d3a4e-9a59-4f43-8c55-6b0d3a4e9a59",
  type: "product",
  title: "Asiatic Lily Bulb",
  description: "",
  category: "Bulbs",
  tags: ["Perennials", { name: "Cut flowers" }],
};
const FERN = { id: "f", type: "product", title: "Boston Fern", description: "", category: "Houseplants" };

describe("catalogue search matching", () => {
  it("is case-insensitive and matches part of a word", () => {
    for (const query of ["hydrangea", "HYDRANGEA", "Hydrangea", "hydr", "  hydrangea  "]) {
      expect(catalogItemMatches(HYDRANGEA, query)).toBe(true);
    }
    expect(catalogItemMatches(FERN, "hydrangea")).toBe(false);
  });

  it("treats singular and plural as the same word", () => {
    expect(catalogItemMatches(HYDRANGEA, "hydrangeas")).toBe(true);
    expect(catalogItemMatches(LILY, "lilies")).toBe(true);
    expect(catalogItemMatches({ ...LILY, title: "Asiatic Lilies" }, "lily")).toBe(true);
    expect(catalogItemMatches({ ...FERN, title: "Window boxes" }, "box")).toBe(true);
    expect(wordVariants("hydrangeas")).toContain("hydrangea");
    expect(wordVariants("glass")).toEqual(["glass"]);
  });

  it("searches the description, category and tags as well as the title", () => {
    expect(catalogItemMatches(VIBURNUM, "hydrangea")).toBe(true);
    expect(catalogItemMatches(HYDRANGEA, "shrubs")).toBe(true);
    expect(catalogItemMatches(HYDRANGEA, "shrub")).toBe(true);
    expect(catalogItemMatches(LILY, "perennial")).toBe(true);
    expect(catalogItemMatches(LILY, "cut flower")).toBe(true);
    // Markup in descriptions is not searchable text.
    expect(catalogItemMatches({ ...FERN, description: "<strong>Lush</strong>" }, "strong")).toBe(false);
  });

  it("needs every word, in any order, ignoring accents and punctuation", () => {
    expect(catalogItemMatches(HYDRANGEA, "summer hydrangea")).toBe(true);
    expect(catalogItemMatches(HYDRANGEA, "endless, summer!")).toBe(true);
    expect(catalogItemMatches(HYDRANGEA, "hydrangea rose")).toBe(false);
    expect(textMatchesSearch("Crème Brûlée Coleus", "creme brulee")).toBe(true);
  });

  it("sends the singular form upstream only when it differs", () => {
    expect(singularQuery("Hydrangeas")).toBe("hydrangea");
    expect(singularQuery("hydrangea")).toBe("");
    expect(singularQuery("")).toBe("");
  });

  it("adds local matches from the unfiltered page to the website's own results", () => {
    // The website's own search found nothing for "hydrangea".
    const merged = mergeCatalogMatches("hydrangea", [[], []], [FERN, HYDRANGEA, LILY, VIBURNUM], 24);
    expect(merged.map((item) => item.id)).toEqual([HYDRANGEA.id, VIBURNUM.id]);
  });

  it("keeps the website's results first, de-duplicates and caps at the limit", () => {
    const merged = mergeCatalogMatches("hydrangea", [[VIBURNUM], [VIBURNUM]], [HYDRANGEA, VIBURNUM], 24);
    expect(merged.map((item) => item.id)).toEqual([VIBURNUM.id, HYDRANGEA.id]);
    expect(mergeCatalogMatches("hydrangea", [[VIBURNUM]], [HYDRANGEA], 1)).toHaveLength(1);
  });
});

describe("connected-content function", () => {
  const source = readFileSync("supabase/functions/connected-content/index.ts", "utf8");

  it("matches searches itself instead of relying on the website's search alone", () => {
    expect(source).toContain('from "../_shared/catalogSearch.ts"');
    expect(source).toMatch(/mergeCatalogMatches\(query,/);
    expect(source).toMatch(/optional\("",UNFILTERED_PAGE\)/);
    expect(source).toMatch(/singularQuery\(query\)/);
  });

  it("still scopes every catalogue read to the caller's tenant links", () => {
    expect(source).toMatch(/\.eq\("tenant_id",tenantId\)\.eq\("status","active"\)/);
    expect(source).toMatch(/upstream\.searchParams\.set\("siteId",link\.cms_site_id\)/);
  });
});

describe("catalogue empty state", () => {
  it("says what was searched and where", () => {
    expect(
      catalogNoMatchesMessage({ query: " hydrangea ", kindLabel: "products", siteNames: ["Northfield Garden Center"] }),
    ).toBe('No products match "hydrangea" in Northfield Garden Center\'s catalogue.');
    expect(catalogNoMatchesMessage({ query: "", kindLabel: "events", siteNames: ["A", "B", "A"] })).toBe(
      "No published events were found in A and B's catalogue.",
    );
    expect(catalogNoMatchesMessage({ query: "fern", kindLabel: "product photos", siteNames: [] })).toBe(
      'No product photos match "fern" in your website\'s catalogue.',
    );
  });
});

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/connectedContent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/connectedContent")>();
  return { ...actual, connectedContentRequest: request };
});
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

describe("From my website picker", () => {
  afterEach(() => {
    cleanup();
    request.mockReset();
  });

  it("names the search and the website when nothing matches", async () => {
    const empty: ConnectedContentResponse = {
      connections: [{
        id: "c1",
        cms_site_id: "37c1cf85-a81e-4185-aebc-83862a4096f0",
        site_name: "Northfield Garden Center",
        site_origin: "https://northfield.example",
        status: "active",
        linked_at: "2026-11-01T00:00:00Z",
      }],
      items: [],
      sources: [{ siteId: "37c1cf85-a81e-4185-aebc-83862a4096f0" }],
      errors: [],
    };
    request.mockResolvedValue(empty);
    const { ConnectedContentPicker } = await import("@/components/crm/studio/ConnectedContentPicker");
    render(React.createElement(ConnectedContentPicker, { open: true, onClose: vi.fn(), onInsert: vi.fn() }));
    fireEvent.click(await screen.findByRole("button", { name: "Products" }));
    fireEvent.change(screen.getByLabelText("Search website content"), { target: { value: "Hydrangeas" } });
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        'No products match "Hydrangeas" in Northfield Garden Center\'s catalogue.',
      ),
    );
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ action: "catalog", type: "products", q: "Hydrangeas" }));
  });
});
