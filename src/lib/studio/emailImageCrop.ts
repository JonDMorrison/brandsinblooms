import { clampImageFocalPoint } from "./imageFocalPoint.ts";

/**
 * Real image crops for email.
 *
 * Cover-fit images rely on CSS `object-fit:cover` and `object-position`, which
 * Gmail, Outlook desktop and Yahoo ignore: they stretch the image to the fixed
 * box instead of cropping it, and the focal point has no effect.
 *
 * Studio now stores a real cropped copy on the block (`croppedImageUrl`) for
 * the exact frame and focal point (`croppedImageKey`): an imgix crop URL for
 * Unsplash images, or an uploaded canvas crop for anything else. The renderer
 * uses that copy only when its key still matches the block.
 *
 * Blocks without a crop (every campaign sent before this change) render
 * exactly as before, so re-rendering a sent campaign is unchanged.
 */

export interface ImageCropFrame {
  /** Rendered width in CSS pixels. */
  width: number;
  /** Rendered height in CSS pixels. */
  height: number;
}

export interface ResolvedEmailImage {
  src: string;
  /** True when `src` already has the frame's aspect ratio and focal crop, so
   *  the <img> can use height:auto without object-fit. */
  cropped: boolean;
}

type CroppableBlock = {
  imageFocalX?: number;
  imageFocalY?: number;
  croppedImageUrl?: string;
  croppedImageKey?: string;
};

/** Aspect ratio rounded so tiny pixel differences do not invalidate a crop. */
function frameAspect(frame: ImageCropFrame) {
  return (frame.width / Math.max(1, frame.height)).toFixed(3);
}

export function buildImageCropKey(
  imageUrl: string,
  frame: ImageCropFrame,
  focalX: unknown,
  focalY: unknown,
) {
  return [
    imageUrl,
    frameAspect(frame),
    Math.round(clampImageFocalPoint(focalX)),
    Math.round(clampImageFocalPoint(focalY)),
  ].join("|");
}

export function isUnsplashImageUrl(imageUrl: string) {
  try {
    return new URL(imageUrl).hostname === "images.unsplash.com";
  } catch {
    return false;
  }
}

/** imgix crop for Unsplash, at 2x for high-density screens. */
export function buildUnsplashCropUrl(
  imageUrl: string,
  frame: ImageCropFrame,
  focalX: unknown,
  focalY: unknown,
) {
  const url = new URL(imageUrl);
  for (const key of ["w", "h", "fit", "crop", "fp-x", "fp-y", "rect", "ar"]) {
    url.searchParams.delete(key);
  }
  url.searchParams.set("w", String(Math.round(frame.width * 2)));
  url.searchParams.set("h", String(Math.round(frame.height * 2)));
  url.searchParams.set("fit", "crop");
  url.searchParams.set("crop", "focalpoint");
  url.searchParams.set(
    "fp-x",
    (clampImageFocalPoint(focalX) / 100).toFixed(2),
  );
  url.searchParams.set(
    "fp-y",
    (clampImageFocalPoint(focalY) / 100).toFixed(2),
  );
  if (!url.searchParams.has("auto")) url.searchParams.set("auto", "format");
  if (!url.searchParams.has("q")) url.searchParams.set("q", "80");
  return url.toString();
}

export function resolveCroppedEmailImage(
  block: CroppableBlock,
  imageUrl: string,
  frame: ImageCropFrame,
): ResolvedEmailImage {
  if (!imageUrl || frame.width <= 0 || frame.height <= 0) {
    return { src: imageUrl, cropped: false };
  }

  if (
    typeof block.croppedImageUrl === "string" &&
    block.croppedImageUrl &&
    block.croppedImageKey ===
      buildImageCropKey(imageUrl, frame, block.imageFocalX, block.imageFocalY)
  ) {
    return { src: block.croppedImageUrl, cropped: true };
  }

  return { src: imageUrl, cropped: false };
}

/**
 * Desktop Outlook (Word engine) ignores `object-fit`. A photo cropped only by
 * CSS, with a fixed pixel height, is squashed to that height there. This
 * gives Outlook the whole photo at its own proportions and every other
 * client the cropped one. `src` and `alt` must already be attribute-escaped.
 */
export function withOutlookWholePhoto(
  croppedImageHtml: string,
  image: { src: string; alt: string; width: number },
): string {
  const width = Math.max(1, Math.round(image.width));
  return `<!--[if mso]><img src="${image.src}" alt="${image.alt}" width="${width}" style="display:block;width:${width}px;height:auto;border:0;" /><![endif]--><!--[if !mso]><!-->${croppedImageHtml}<!--<![endif]-->`;
}
