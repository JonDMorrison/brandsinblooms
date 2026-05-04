import React from "react";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Typography from "@mui/joy/Typography";
import type { AIImageStudioOpenOptions } from "@/components/crm/ai-image-studio/types";

interface AIImageStudioContextValue {
  close: () => void;
  isOpen: boolean;
  open: (options: AIImageStudioOpenOptions) => void;
}

const AIImageStudioContext = React.createContext<
  AIImageStudioContextValue | undefined
>(undefined);

const LazyAIImageStudioHost = React.lazy(
  () => import("@/components/crm/ai-image-studio/AIImageStudioHost"),
);

function AIImageStudioFallback() {
  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: (theme) => (theme.vars.zIndex.modal ?? theme.zIndex.modal) + 1,
        backgroundColor: "rgba(10, 17, 12, 0.5)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <Box
        sx={{
          px: 3,
          py: 2.5,
          borderRadius: "24px",
          backgroundColor: "background.surface",
          boxShadow: "lg",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <CircularProgress size="sm" />
        <Typography level="body-sm" fontWeight="md">
          Loading AI Image Studio
        </Typography>
      </Box>
    </Box>
  );
}

export function AIImageStudioProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [options, setOptions] = React.useState<AIImageStudioOpenOptions | null>(
    null,
  );
  const closeCallbackRef = React.useRef<(() => void) | null>(null);

  const close = React.useCallback(() => {
    setIsOpen(false);
    const closeCallback = closeCallbackRef.current;
    closeCallbackRef.current = null;
    closeCallback?.();
  }, []);

  const open = React.useCallback((nextOptions: AIImageStudioOpenOptions) => {
    closeCallbackRef.current = nextOptions.onClose ?? null;
    setOptions(nextOptions);
    setIsOpen(true);
  }, []);

  const value = React.useMemo<AIImageStudioContextValue>(
    () => ({ close, isOpen, open }),
    [close, isOpen, open],
  );

  return (
    <AIImageStudioContext.Provider value={value}>
      {children}

      <React.Suspense fallback={isOpen ? <AIImageStudioFallback /> : null}>
        {options ? (
          <LazyAIImageStudioHost
            open={isOpen}
            onClose={close}
            options={options}
          />
        ) : null}
      </React.Suspense>
    </AIImageStudioContext.Provider>
  );
}

export function useAIImageStudioContext() {
  const context = React.useContext(AIImageStudioContext);

  if (!context) {
    throw new Error(
      "useAIImageStudio must be used within AIImageStudioProvider",
    );
  }

  return context;
}
