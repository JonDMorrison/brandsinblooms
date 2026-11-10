const DEFAULT_FOCAL_POINT = 50;

export function clampImageFocalPoint(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : DEFAULT_FOCAL_POINT;
}

export function getImageObjectPosition(
  horizontal: unknown,
  vertical: unknown,
): string {
  return `${clampImageFocalPoint(horizontal)}% ${clampImageFocalPoint(vertical)}%`;
}
