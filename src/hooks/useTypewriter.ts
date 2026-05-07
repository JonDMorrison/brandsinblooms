import { useEffect, useState } from "react";

export interface UseTypewriterOptions {
  phrases: string[];
  typeSpeedMs?: number;
  eraseSpeedMs?: number;
  pauseAfterTypeMs?: number;
  pauseAfterEraseMs?: number;
}

export const useTypewriter = ({
  phrases,
  typeSpeedMs = 60,
  eraseSpeedMs = 35,
  pauseAfterTypeMs = 2000,
  pauseAfterEraseMs = 400,
}: UseTypewriterOptions) => {
  const [text, setText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isErasing, setIsErasing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setText(phrases[0] ?? "");
      return;
    }

    const currentPhrase = phrases[phraseIndex] ?? "";

    if (isPaused) {
      const id = window.setTimeout(() => {
        setIsPaused(false);
        setIsErasing(true);
      }, pauseAfterTypeMs);
      return () => window.clearTimeout(id);
    }

    if (!isErasing && text === currentPhrase) {
      setIsPaused(true);
      return;
    }

    if (isErasing && text === "") {
      const id = window.setTimeout(() => {
        setIsErasing(false);
        setPhraseIndex((idx) => (idx + 1) % phrases.length);
      }, pauseAfterEraseMs);
      return () => window.clearTimeout(id);
    }

    const id = window.setTimeout(() => {
      setText((current) => {
        if (isErasing) return current.slice(0, -1);
        return currentPhrase.slice(0, current.length + 1);
      });
    }, isErasing ? eraseSpeedMs : typeSpeedMs);
    return () => window.clearTimeout(id);
  }, [
    text,
    phraseIndex,
    isErasing,
    isPaused,
    phrases,
    typeSpeedMs,
    eraseSpeedMs,
    pauseAfterTypeMs,
    pauseAfterEraseMs,
  ]);

  return text;
};
