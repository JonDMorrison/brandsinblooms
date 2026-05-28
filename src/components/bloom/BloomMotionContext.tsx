import * as React from "react";
import useMediaQuery from "@/hooks/use-media-query";

const BloomMotionContext = React.createContext(false);

interface BloomMotionProviderProps {
  children: React.ReactNode;
}

export function BloomMotionProvider({ children }: BloomMotionProviderProps) {
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );

  return (
    <BloomMotionContext.Provider value={prefersReducedMotion}>
      {children}
    </BloomMotionContext.Provider>
  );
}

export function useBloomReducedMotion() {
  return React.useContext(BloomMotionContext);
}
