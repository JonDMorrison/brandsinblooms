import { useState, useEffect } from 'react';

interface UseTypingEffectOptions {
  text: string;
  delay?: number;
  speed?: number;
}

export const useTypingEffect = ({ 
  text, 
  delay = 1000, 
  speed = 50 
}: UseTypingEffectOptions) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!text) return;

    // Reset state when text changes
    setDisplayedText('');
    setIsComplete(false);
    setHasStarted(false);

    // Start typing after delay
    const startTimeout = setTimeout(() => {
      setHasStarted(true);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [text, delay]);

  useEffect(() => {
    if (!hasStarted || !text) return;

    let currentIndex = 0;
    const typeText = () => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        setIsComplete(true);
      }
    };

    const interval = setInterval(typeText, speed);

    return () => clearInterval(interval);
  }, [hasStarted, text, speed]);

  return {
    displayedText,
    isComplete,
    hasStarted
  };
};