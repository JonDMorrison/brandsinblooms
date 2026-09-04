import { describe, expect, it } from "vitest";
import {
  clampImageFocalPoint,
  getImageObjectPosition,
} from "@/lib/studio/imageFocalPoint";

describe("imageFocalPoint", () => {
  it("uses the image center by default", () => {
    expect(getImageObjectPosition(undefined, undefined)).toBe("50% 50%");
  });

  it("clamps persisted values to a safe percentage", () => {
    expect(clampImageFocalPoint(-15)).toBe(0);
    expect(clampImageFocalPoint(140)).toBe(100);
    expect(getImageObjectPosition(20, 85)).toBe("20% 85%");
  });
});
