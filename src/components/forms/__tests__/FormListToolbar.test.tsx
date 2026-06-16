import "@testing-library/jest-dom/vitest";

import * as React from "react";
import { render, screen } from "@testing-library/react";
import { CssVarsProvider } from "@mui/joy/styles";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { joyTheme } from "@/config/joy-theme";
import { FormListToolbar } from "@/components/forms/FormListToolbar";

beforeAll(() => {
  // Joy's CssVarsProvider calls window.matchMedia for color-scheme
  // detection; JSDOM doesn't ship it. Production browsers do.
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

/**
 * Locks in the fix for incidents MQGT8U01-STKT and MQGVPKVA-2MJE — Jeff
 * at Brands in Blooms hit a render-time TypeError on /crm/forms because
 * the Joy beta-52 theme was missing `breakpoints.internal_mediaKeys`,
 * which the top-level @mui/system@9 styleFunctionSx requires when
 * processing any responsive sx value. FormListToolbar uses several
 * responsive sx objects (`display: { xs: "none", sm: "flex" }` etc.) and
 * fired the crash on every render.
 *
 * This test mounts the toolbar under the actual app `joyTheme` and a
 * Joy CssVarsProvider, exercising the responsive-sx code path. If
 * `internal_mediaKeys` ever gets dropped from the theme again, the
 * mount throws here with the original error.
 */
describe("FormListToolbar — responsive sx under the real joyTheme", () => {
  function renderWithProvider() {
    return render(
      <CssVarsProvider theme={joyTheme} defaultMode="light">
        <FormListToolbar
          searchValue=""
          onSearchChange={vi.fn()}
          statusFilter="all"
          onStatusChange={vi.fn()}
          sortValue="updated-desc"
          onSortChange={vi.fn()}
          viewMode="grid"
          onViewModeChange={vi.fn()}
          onNewForm={vi.fn()}
          onClearFilters={vi.fn()}
          statusCounts={{ all: 3, draft: 0, published: 3, archived: 0 }}
          sortOptions={[
            { value: "updated-desc", label: "Last modified" },
            { value: "name-asc", label: "Name A-Z" },
          ]}
          isLoading={false}
          formCount={3}
          filteredFormCount={3}
        />
      </CssVarsProvider>,
    );
  }

  it("mounts without throwing", () => {
    renderWithProvider();
    expect(screen.getByPlaceholderText("Search forms…")).toBeInTheDocument();
  });

  it("renders the New form button (responsive sx on the desktop variant)", () => {
    renderWithProvider();
    expect(screen.getByText("New form")).toBeInTheDocument();
  });
});
