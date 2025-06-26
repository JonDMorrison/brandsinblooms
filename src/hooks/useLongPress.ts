
import { useCallback, useRef, useState } from 'react';

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  longPressThreshold?: number;
}

export const useLongPress = ({
  onLongPress,
  onClick,
  longPressThreshold = 300
}: UseLongPressOptions) => {
  const [isLongPressActive, setIsLongPressActive] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const start = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    setIsPressed(true);
    isLongPress.current = false;

    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsLongPressActive(true);
      onLongPress();
    }, longPressThreshold);
  }, [onLongPress, longPressThreshold]);

  const clear = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsPressed(false);
    setIsLongPressActive(false);
  }, []);

  const end = useCallback(() => {
    clear();
    if (!isLongPress.current && onClick) {
      onClick();
    }
  }, [clear, onClick]);

  return {
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: end,
    isLongPressActive,
    isPressed
  };
};
