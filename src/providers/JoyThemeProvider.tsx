import { useLayoutEffect, type ReactNode } from "react";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { CssVarsProvider, useColorScheme } from "@mui/joy/styles";
import { joyTheme } from "@/config/joy-theme";

const insertionPoint =
  typeof document !== "undefined"
    ? (document.querySelector<HTMLMetaElement>(
        'meta[name="emotion-insertion-point"]',
      ) ?? undefined)
    : undefined;

const joyEmotionCache = createCache({
  key: "joy",
  prepend: true,
  ...(insertionPoint ? { insertionPoint } : {}),
});

/**
 * Joy owns the colour scheme (`data-joy-color-scheme` on <html>). Tailwind's
 * `darkMode: ["class"]` variants key off `.dark`, so mirror Joy's resolved
 * scheme onto that class to keep both systems in lockstep.
 */
function TailwindColorSchemeSync() {
  const { colorScheme } = useColorScheme();

  useLayoutEffect(() => {
    if (!colorScheme) {
      return;
    }

    const root = document.documentElement;
    root.classList.toggle("dark", colorScheme === "dark");
    root.style.colorScheme = colorScheme;
  }, [colorScheme]);

  return null;
}

/**
 * Joy persists the light/dark scheme mapping under `${key}-light|dark`. The
 * previous `defaultColorScheme="light"` wrote `joy-color-scheme-dark=light`
 * into every visitor's storage, which would pin dark mode to the light
 * palette forever. A fresh key drops that stale mapping. Keep in sync with
 * the pre-paint script in index.html.
 */
const COLOR_SCHEME_STORAGE_KEY = "bloom-color-scheme";

interface JoyThemeProviderProps {
  children: ReactNode;
}

export function JoyThemeProvider({ children }: JoyThemeProviderProps) {
  return (
    <CacheProvider value={joyEmotionCache}>
      <CssVarsProvider
        theme={joyTheme}
        defaultMode="light"
        defaultColorScheme={{ light: "light", dark: "dark" }}
        colorSchemeStorageKey={COLOR_SCHEME_STORAGE_KEY}
        disableTransitionOnChange
      >
        <TailwindColorSchemeSync />
        {children}
      </CssVarsProvider>
    </CacheProvider>
  );
}
