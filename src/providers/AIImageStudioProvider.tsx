import React from "react";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Typography from "@mui/joy/Typography";
import type {
  AIImageStudioContextUpdate,
  AIImageStudioOpenOptions,
  AIImageStudioSelectHandler,
} from "@/components/crm/ai-image-studio/types";

export interface AIImageStudioContextValue {
  close: () => void;
  getCurrentOptions: () => AIImageStudioOpenOptions | null;
  isOpen: boolean;
  open: (options: AIImageStudioOpenOptions) => void;
  subscribeToOptions: (
    listener: (options: AIImageStudioOpenOptions) => void,
  ) => () => void;
  updateContext: (nextContext: AIImageStudioContextUpdate | string) => void;
  updateOnSelect: (nextOnSelect: AIImageStudioSelectHandler) => void;
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
  const optionsRef = React.useRef<AIImageStudioOpenOptions | null>(null);
  const optionListenersRef = React.useRef(
    new Set<(options: AIImageStudioOpenOptions) => void>(),
  );

  const notifyOptionListeners = React.useCallback(
    (nextOptions: AIImageStudioOpenOptions | null) => {
      if (!nextOptions) {
        return;
      }

      optionListenersRef.current.forEach((listener) => {
        listener(nextOptions);
      });
    },
    [],
  );

  const close = React.useCallback(() => {
    setIsOpen(false);
    const closeCallback = closeCallbackRef.current;
    closeCallbackRef.current = null;
    closeCallback?.();
  }, []);

  const open = React.useCallback((nextOptions: AIImageStudioOpenOptions) => {
    closeCallbackRef.current = nextOptions.onClose ?? null;
    optionsRef.current = nextOptions;
    setOptions(nextOptions);
    setIsOpen(true);
  }, []);

  const updateOnSelect = React.useCallback(
    (nextOnSelect: AIImageStudioSelectHandler) => {
      if (!optionsRef.current) {
        return;
      }

      optionsRef.current = {
        ...optionsRef.current,
        onSelect: nextOnSelect,
      };
    },
    [],
  );

  const updateContext = React.useCallback(
    (nextContext: AIImageStudioContextUpdate | string) => {
      if (!optionsRef.current) {
        return;
      }

      const contextPatch =
        typeof nextContext === "string"
          ? {
              contentContext: nextContext,
              contextLabel: nextContext,
            }
          : nextContext;

      optionsRef.current = {
        ...optionsRef.current,
        ...contextPatch,
      };
      notifyOptionListeners(optionsRef.current);
    },
    [notifyOptionListeners],
  );

  const getCurrentOptions = React.useCallback(() => optionsRef.current, []);

  const subscribeToOptions = React.useCallback(
    (listener: (options: AIImageStudioOpenOptions) => void) => {
      optionListenersRef.current.add(listener);

      if (optionsRef.current) {
        listener(optionsRef.current);
      }

      return () => {
        optionListenersRef.current.delete(listener);
      };
    },
    [],
  );

  const value = React.useMemo<AIImageStudioContextValue>(
    () => ({
      close,
      getCurrentOptions,
      isOpen,
      open,
      subscribeToOptions,
      updateContext,
      updateOnSelect,
    }),
    [
      close,
      getCurrentOptions,
      isOpen,
      open,
      subscribeToOptions,
      updateContext,
      updateOnSelect,
    ],
  );

  return (
    <AIImageStudioContext.Provider value={value}>
      {children}

      <React.Suspense fallback={isOpen ? <AIImageStudioFallback /> : null}>
        {options ? (
          <LazyAIImageStudioHost
            getCurrentOptions={getCurrentOptions}
            open={isOpen}
            onClose={close}
            options={options}
            subscribeToOptions={subscribeToOptions}
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
