import IconButton from "@mui/joy/IconButton";
import { ArrowDown } from "lucide-react";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";

interface BloomScrollToBottomProps {
  visible: boolean;
  onClick: () => void;
}

export function BloomScrollToBottom({
  onClick,
  visible,
}: BloomScrollToBottomProps) {
  const reducedMotion = useBloomReducedMotion();

  return (
    <IconButton
      aria-label="Scroll to bottom"
      color="neutral"
      variant="solid"
      onClick={onClick}
      sx={{
        position: "absolute",
        right: { xs: 12, sm: 16 },
        bottom: { xs: 12, sm: 16 },
        width: 40,
        height: 40,
        borderRadius: "999px",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transform: reducedMotion
          ? "translateY(0)"
          : visible
            ? "translateY(0)"
            : "translateY(6px)",
        transition: reducedMotion
          ? "none"
          : "opacity 150ms ease, transform 150ms ease, background-color 150ms ease",
        boxShadow: "var(--joy-shadow-md)",
        zIndex: 2,
      }}
    >
      <ArrowDown size={18} strokeWidth={1.9} />
    </IconButton>
  );
}
