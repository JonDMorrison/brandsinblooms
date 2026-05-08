import type { CSSProperties } from "react";

interface BrandFoliageProps {
  className?: string;
  style?: CSSProperties;
  /**
   * Base color for the two leaves that use `currentColor`. Set via
   * the `color` CSS property on a parent or pass a hex/var() string.
   * Defaults to undefined (inherits currentColor).
   */
  color?: string;
}

/**
 * Botanical decoration: 5 leaf-teardrop shapes scattered with
 * staggered rotations and opacities. Two leaves use `currentColor`
 * (so the parent can theme them), three are pinned to specific brand
 * teal stops via `--auth-green-*` / `--hp-green-*` variables (both
 * ramps share identical hex values).
 *
 * The leaf path matches the bezier teardrop drawn by
 * AuthNanoLeafParticles (control points 0.72/-0.42 and 0.66/0.48
 * from authParticles.ts) so static and animated decorations stay
 * visually continuous on any surface.
 *
 * Decorative only — `aria-hidden="true"` + `pointer-events: none`
 * on the wrapper. Position via the parent (typically absolute,
 * anchored to a corner).
 */
export const BrandFoliage = ({
  className,
  style,
  color,
}: BrandFoliageProps) => (
  <svg
    viewBox="0 0 320 240"
    fill="none"
    aria-hidden="true"
    focusable="false"
    className={className}
    style={color ? { color, ...style } : style}
  >
    <g transform="translate(220 130) rotate(-22)" opacity="0.55">
      <path
        d="M50 0 C 86 29 83 74 50 100 C 17 74 14 29 50 0 Z"
        fill="currentColor"
      />
    </g>
    <g
      transform="translate(160 110) rotate(18) scale(1.1)"
      opacity="0.42"
    >
      <path
        d="M50 0 C 86 29 83 74 50 100 C 17 74 14 29 50 0 Z"
        fill="var(--auth-green-300, var(--hp-green-300, #87DFD8))"
      />
    </g>
    <g transform="translate(110 150) rotate(-58)" opacity="0.5">
      <path
        d="M50 0 C 86 29 83 74 50 100 C 17 74 14 29 50 0 Z"
        fill="currentColor"
      />
    </g>
    <g
      transform="translate(60 90) rotate(34) scale(0.74)"
      opacity="0.36"
    >
      <path
        d="M50 0 C 86 29 83 74 50 100 C 17 74 14 29 50 0 Z"
        fill="var(--auth-green-500, var(--hp-green-500, #3E7C77))"
      />
    </g>
    <g
      transform="translate(245 60) rotate(72) scale(0.68)"
      opacity="0.32"
    >
      <path
        d="M50 0 C 86 29 83 74 50 100 C 17 74 14 29 50 0 Z"
        fill="var(--auth-green-300, var(--hp-green-300, #87DFD8))"
      />
    </g>
  </svg>
);

export default BrandFoliage;
