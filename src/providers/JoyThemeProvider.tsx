import type { ReactNode } from "react";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { CssVarsProvider } from "@mui/joy/styles";
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

interface JoyThemeProviderProps {
  children: ReactNode;
}

export function JoyThemeProvider({ children }: JoyThemeProviderProps) {
  return (
    <CacheProvider value={joyEmotionCache}>
      <CssVarsProvider
        theme={joyTheme}
        defaultMode="light"
        defaultColorScheme="light"
        disableTransitionOnChange
      >
        {children}
      </CssVarsProvider>
    </CacheProvider>
  );
}
