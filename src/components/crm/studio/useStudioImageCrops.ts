import * as React from "react";
import { uploadStudioImageFile } from "@/components/crm/studio/fields/StudioImageUpload";
import {
  buildImageCropKey,
  buildUnsplashCropUrl,
  isUnsplashImageUrl,
  type ImageCropFrame,
} from "@/lib/studio/emailImageCrop";
import { clampImageFocalPoint } from "@/lib/studio/imageFocalPoint";
import { getEmailImageCropFrame } from "@/lib/studio/emailHtmlGenerator";
import type { StudioBlock } from "@/types/studioBlocks";

const CROP_DEBOUNCE_MS = 1200;
/** Output scale: 2x the rendered frame for high-density screens. */
const CROP_SCALE = 2;
const MAX_OUTPUT_WIDTH = 1400;

interface PendingCrop {
  blockId: string;
  imageUrl: string;
  frame: ImageCropFrame;
  focalX: number;
  focalY: number;
  key: string;
}

/**
 * Which image blocks need a real cropped copy. data:/relative URLs never
 * reach the inbox, so they are skipped.
 */
export function collectPendingImageCrops(blocks: StudioBlock[]): PendingCrop[] {
  const pending: PendingCrop[] = [];
  for (const block of blocks) {
    const imageUrl = typeof block.imageUrl === "string" ? block.imageUrl.trim() : "";
    if (!/^https:\/\//i.test(imageUrl)) continue;
    const frame = getEmailImageCropFrame(block);
    if (!frame) continue;
    const key = buildImageCropKey(imageUrl, frame, block.imageFocalX, block.imageFocalY);
    if (block.croppedImageKey === key && block.croppedImageUrl) continue;
    pending.push({
      blockId: block.id,
      imageUrl,
      frame,
      focalX: clampImageFocalPoint(block.imageFocalX),
      focalY: clampImageFocalPoint(block.imageFocalY),
      key,
    });
  }
  return pending;
}

/** Source rectangle for a cover crop of `natural` into `frame` around a focal point. */
export function computeCoverCropRect(
  natural: { width: number; height: number },
  frame: ImageCropFrame,
  focalX: number,
  focalY: number,
) {
  const targetAspect = frame.width / frame.height;
  const naturalAspect = natural.width / natural.height;
  let sw = natural.width;
  let sh = natural.height;
  if (naturalAspect > targetAspect) {
    sw = Math.round(natural.height * targetAspect);
  } else {
    sh = Math.round(natural.width / targetAspect);
  }
  const sx = Math.round(Math.min(Math.max((natural.width * focalX) / 100 - sw / 2, 0), natural.width - sw));
  const sy = Math.round(Math.min(Math.max((natural.height * focalY) / 100 - sh / 2, 0), natural.height - sh));
  return { sx, sy, sw, sh };
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded for cropping"));
    image.src = url;
  });
}

async function cropToFile(crop: PendingCrop): Promise<File> {
  const image = await loadImage(crop.imageUrl);
  const rect = computeCoverCropRect(
    { width: image.naturalWidth, height: image.naturalHeight },
    crop.frame,
    crop.focalX,
    crop.focalY,
  );
  const outWidth = Math.min(MAX_OUTPUT_WIDTH, crop.frame.width * CROP_SCALE, rect.sw);
  const outHeight = Math.round((outWidth * crop.frame.height) / crop.frame.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(outWidth));
  canvas.height = Math.max(1, outHeight);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, canvas.width, canvas.height);
  // toBlob throws for a cross-origin image without CORS; callers fall back.
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.86),
  );
  if (!blob) throw new Error("Cropped image could not be encoded");
  return new File([blob], "crop.jpg", { type: "image/jpeg" });
}

/**
 * Keeps a real cropped copy of each cover-cropped image in sync with its
 * frame and focal point, so sent email shows the same crop as Studio in
 * clients that ignore CSS object-fit (Gmail, Outlook desktop, Yahoo).
 * Failures are silent: the email falls back to the CSS crop.
 */
export function useStudioImageCrops(
  blocks: StudioBlock[],
  annotateBlockFields: (blockId: string, fields: Partial<StudioBlock>) => void,
  enabled: boolean,
) {
  const inFlightRef = React.useRef(new Set<string>());
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const failedRef = React.useRef(new Set<string>());
  const pending = React.useMemo(
    () => (enabled ? collectPendingImageCrops(blocks) : []),
    [blocks, enabled],
  );
  const pendingSignature = pending.map((item) => `${item.blockId}:${item.key}`).join(",");

  React.useEffect(() => {
    if (!pending.length) return;
    const timer = window.setTimeout(() => {
      for (const crop of pending) {
        const token = `${crop.blockId}:${crop.key}`;
        if (inFlightRef.current.has(token) || failedRef.current.has(crop.key)) continue;
        inFlightRef.current.add(token);
        // Unsplash (imgix) crops on request: no upload needed.
        const cropUrl = isUnsplashImageUrl(crop.imageUrl)
          ? Promise.resolve(
              buildUnsplashCropUrl(crop.imageUrl, crop.frame, crop.focalX, crop.focalY),
            )
          : cropToFile(crop).then((file) => uploadStudioImageFile(file));
        void cropUrl
          .then((publicUrl) => {
            // A crop made for an older frame is harmless: its key no longer
            // matches, so the renderer ignores it and this hook re-crops.
            if (mountedRef.current) {
              annotateBlockFields(crop.blockId, {
                croppedImageUrl: publicUrl,
                croppedImageKey: crop.key,
              });
            }
          })
          .catch((error) => {
            failedRef.current.add(crop.key);
            console.warn("Studio image crop skipped; email will use the CSS crop", error);
          })
          .finally(() => {
            inFlightRef.current.delete(token);
          });
      }
    }, CROP_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
    // pendingSignature captures every input that changes what to crop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSignature, annotateBlockFields]);
}
