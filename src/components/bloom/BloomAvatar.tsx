import * as React from "react";
import Box from "@mui/joy/Box";
import bloomLogo from "@/assets/logos/bloom-logo.png";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";

export interface BloomAvatarProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const avatarSizeMap = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
  xl: 72,
} as const;

function resolveAvatarSize(size: BloomAvatarProps["size"]) {
  if (typeof size === "number") {
    return size;
  }

  return avatarSizeMap[size ?? "md"];
}

export function BloomAvatar({
  animate = false,
  className,
  size = "md",
  style,
}: BloomAvatarProps) {
  const dimension = resolveAvatarSize(size);
  const logoDimension = Math.max(12, Math.round(dimension * 0.78));
  const reducedMotion = useBloomReducedMotion();

  return (
    <Box
      className={className}
      style={style}
      sx={{
        width: dimension,
        height: dimension,
        alignItems: "center",
        backgroundColor: "background.surface",
        border: "1px solid",
        borderColor: "neutral.outlinedBorder",
        borderRadius: "50%",
        display: "flex",
        flexShrink: 0,
        justifyContent: "center",
        overflow: "hidden",
        animation:
          animate && !reducedMotion
            ? "bloomAvatarBreath 4s ease-in-out infinite"
            : "none",
        "@keyframes bloomAvatarBreath": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.04)" },
        },
      }}
    >
      <Box
        component="img"
        src={bloomLogo}
        alt="Bloom AI"
        width={logoDimension}
        height={logoDimension}
        sx={{
          width: logoDimension,
          height: logoDimension,
          display: "block",
          objectFit: "contain",
          userSelect: "none",
        }}
      />
    </Box>
  );
}
