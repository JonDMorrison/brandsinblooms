import * as React from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Download,
  ImageOff,
  Pencil,
  Save,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard } from "@/components/joy/JoyCard";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import { supabase } from "@/integrations/supabase/client";
import {
  isRecord,
  readNumber,
  readString,
} from "@/components/bloom/blocks/blockUtils";

const IMAGE_STORAGE_BUCKET = "global-ai-images";

export interface ImageBlockProps {
  url: string;
  alt: string;
  enhancedPrompt: string;
  storagePath?: string;
  width?: number;
  height?: number;
  onAction: (prompt: string) => void;
}

type ImageRenderState = "loading" | "loaded" | "error";

function promptPreview(prompt: string): string {
  return prompt.length > 60 ? `${prompt.slice(0, 60).trim()}...` : prompt;
}

function dimensionsFromPayload(payload: Record<string, unknown>): {
  width?: number;
  height?: number;
} {
  const dimensions = isRecord(payload.dimensions) ? payload.dimensions : null;
  return {
    width:
      readNumber(payload.width) ?? readNumber(dimensions?.width) ?? undefined,
    height:
      readNumber(payload.height) ?? readNumber(dimensions?.height) ?? undefined,
  };
}

export function normalizeImagePayload(
  payload: unknown,
): Omit<ImageBlockProps, "onAction"> | null {
  const source = isRecord(payload) ? payload : {};
  const data = isRecord(source.data) ? source.data : source;
  const url =
    readString(data.url) ??
    readString(data.image_url) ??
    readString(data.download_url) ??
    readString(data.signed_url) ??
    readString(data.src) ??
    readString(source.url) ??
    readString(source.image_url) ??
    readString(source.download_url) ??
    readString(source.signed_url) ??
    readString(source.src);

  if (!url) {
    return null;
  }

  const enhancedPrompt =
    readString(data.enhancedPrompt) ??
    readString(data.enhanced_prompt) ??
    readString(data.enriched_prompt) ??
    readString(data.original_prompt) ??
    "Generated garden image";
  const alt =
    readString(data.alt) ?? readString(data.alt_text) ?? enhancedPrompt;
  const dimensions = dimensionsFromPayload(data);

  return {
    url,
    alt,
    enhancedPrompt,
    storagePath:
      readString(data.storage_path) ??
      readString(source.storage_path) ??
      undefined,
    ...dimensions,
  };
}

export const ImageBlock = React.memo(function ImageBlock({
  alt,
  enhancedPrompt,
  height,
  onAction,
  storagePath,
  url,
  width,
}: ImageBlockProps) {
  const reducedMotion = useBloomReducedMotion();
  const retriedSignedUrlRef = React.useRef(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const previousUrlRef = React.useRef(url);
  const [resolvedUrl, setResolvedUrl] = React.useState(url);
  const [pendingUrl, setPendingUrl] = React.useState<string | null>(null);
  const [isInView, setIsInView] = React.useState(false);
  const [imageState, setImageState] =
    React.useState<ImageRenderState>("loading");
  const [expanded, setExpanded] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editedPrompt, setEditedPrompt] = React.useState(enhancedPrompt);
  const aspectRatio = width && height ? `${width} / ${height}` : "1 / 1";
  const trimmedEditedPrompt = editedPrompt.trim();

  React.useEffect(() => {
    const container = containerRef.current;

    if (!container || isInView) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [isInView]);

  React.useEffect(() => {
    if (url === previousUrlRef.current) {
      return;
    }

    previousUrlRef.current = url;
    retriedSignedUrlRef.current = false;

    if (imageState === "loaded") {
      setPendingUrl(url);
      return;
    }

    setResolvedUrl(url);
    setPendingUrl(null);
    setImageState("loading");
  }, [imageState, url]);

  React.useEffect(() => {
    if (!editOpen) {
      setEditedPrompt(enhancedPrompt);
    }
  }, [editOpen, enhancedPrompt]);

  const openEditPrompt = React.useCallback(() => {
    setEditedPrompt(enhancedPrompt);
    setEditOpen(true);
  }, [enhancedPrompt]);

  const submitEditedPrompt = React.useCallback(() => {
    if (!trimmedEditedPrompt) {
      return;
    }

    onAction(`Generate an image: ${trimmedEditedPrompt}`);
    setEditOpen(false);
  }, [onAction, trimmedEditedPrompt]);

  const downloadImage = React.useCallback(() => {
    const anchor = document.createElement("a");
    anchor.href = resolvedUrl;
    anchor.download = "bloom-generated-image.png";
    anchor.rel = "noopener noreferrer";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }, [resolvedUrl]);

  const handleImageLoad = React.useCallback(() => {
    setImageState("loaded");
  }, []);

  const requestSignedUrl = React.useCallback(
    async (nextPath: string): Promise<string | null> => {
      const { data, error } = await supabase.storage
        .from(IMAGE_STORAGE_BUCKET)
        .createSignedUrl(nextPath, 3600);

      if (error || !data?.signedUrl) {
        return null;
      }

      return data.signedUrl;
    },
    [],
  );

  const handleImageError = React.useCallback(async () => {
    if (storagePath && !retriedSignedUrlRef.current) {
      retriedSignedUrlRef.current = true;
      const signedUrl = await requestSignedUrl(storagePath);

      if (signedUrl && signedUrl !== resolvedUrl) {
        setResolvedUrl(signedUrl);
        return;
      }

      setImageState("error");
      return;
    }

    setImageState("error");
  }, [requestSignedUrl, resolvedUrl, storagePath]);

  const handlePendingImageLoad = React.useCallback(() => {
    if (!pendingUrl) {
      return;
    }

    setResolvedUrl(pendingUrl);
    setPendingUrl(null);
    setImageState("loaded");
  }, [pendingUrl]);

  const handlePendingImageError = React.useCallback(async () => {
    if (!pendingUrl) {
      return;
    }

    if (storagePath && !retriedSignedUrlRef.current) {
      retriedSignedUrlRef.current = true;
      const signedUrl = await requestSignedUrl(storagePath);

      if (signedUrl && signedUrl !== pendingUrl) {
        setPendingUrl(signedUrl);
      } else {
        setPendingUrl(null);
      }

      return;
    }

    setPendingUrl(null);
  }, [pendingUrl, requestSignedUrl, storagePath]);

  return (
    <>
      <JoyCard variant="outlined" sx={{ width: "100%" }}>
        <Stack spacing={1.25} sx={{ p: 1.25 }}>
          <Box
            ref={containerRef}
            sx={{
              position: "relative",
              borderRadius: "var(--joy-radius-lg)",
              overflow: "hidden",
              backgroundColor: "background.level1",
              aspectRatio,
              minHeight: { xs: 220, sm: 260 },
              maxHeight: 400,
              width: "100%",
              contain: "layout paint",
              willChange: "auto",
            }}
          >
            {imageState === "loading" ? (
              <Skeleton
                animation={reducedMotion ? false : "wave"}
                variant="rectangular"
                sx={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "var(--joy-radius-lg)",
                }}
              />
            ) : null}

            {imageState === "error" ? (
              <Sheet
                color="neutral"
                variant="soft"
                sx={{
                  minHeight: 220,
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "var(--joy-radius-lg)",
                }}
              >
                <Stack
                  spacing={1}
                  alignItems="center"
                  sx={{ px: 2, textAlign: "center" }}
                >
                  <ImageOff size={24} strokeWidth={1.8} />
                  <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                    Image could not be loaded
                  </Typography>
                  <JoyButton
                    color="neutral"
                    size="sm"
                    variant="outlined"
                    onClick={() => onAction("Regenerate the last image")}
                  >
                    Try Again
                  </JoyButton>
                </Stack>
              </Sheet>
            ) : null}

            {imageState !== "error" && isInView ? (
              <Box
                component="img"
                alt={alt}
                onError={handleImageError}
                onLoad={handleImageLoad}
                src={resolvedUrl}
                sx={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  maxHeight: 400,
                  objectFit: "cover",
                  borderRadius: "var(--joy-radius-lg)",
                  opacity: imageState === "loaded" ? 1 : 0,
                  transition: reducedMotion ? "none" : "opacity 300ms ease",
                  willChange: imageState === "loading" ? "opacity" : "auto",
                }}
              />
            ) : null}

            {imageState === "loaded" && pendingUrl && isInView ? (
              <Box
                component="img"
                alt=""
                aria-hidden="true"
                onError={handlePendingImageError}
                onLoad={handlePendingImageLoad}
                src={pendingUrl}
                sx={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  opacity: 0,
                  pointerEvents: "none",
                }}
              />
            ) : null}
          </Box>

          <Box
            component="button"
            type="button"
            onClick={() => setExpanded((current) => !current)}
            sx={{
              display: "flex",
              gap: 0.75,
              alignItems: "flex-start",
              p: 0,
              border: 0,
              backgroundColor: "transparent",
              color: "neutral.500",
              textAlign: "left",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            <Sparkles
              size={14}
              strokeWidth={1.8}
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <Typography
              level="body-xs"
              sx={{
                color: "neutral.500",
                lineHeight: 1.55,
                overflowWrap: "anywhere",
              }}
            >
              {expanded ? enhancedPrompt : promptPreview(enhancedPrompt)}
            </Typography>
          </Box>

          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            <JoyButton
              color="neutral"
              size="sm"
              variant="outlined"
              startDecorator={<Download size={14} strokeWidth={1.9} />}
              onClick={downloadImage}
            >
              Download
            </JoyButton>
            <JoyButton
              color="neutral"
              size="sm"
              variant="outlined"
              startDecorator={<Save size={14} strokeWidth={1.9} />}
              onClick={() => onAction("Save this image to my gallery")}
            >
              Save to Gallery
            </JoyButton>
            <JoyButton
              color="primary"
              size="sm"
              variant="plain"
              startDecorator={<WandSparkles size={14} strokeWidth={1.9} />}
              onClick={() => onAction("Generate another image like this")}
            >
              Generate Another
            </JoyButton>
            <JoyButton
              color="neutral"
              size="sm"
              variant="plain"
              startDecorator={<Pencil size={14} strokeWidth={1.9} />}
              onClick={openEditPrompt}
            >
              Edit Prompt
            </JoyButton>
          </Stack>
        </Stack>
      </JoyCard>

      <JoyDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Prompt"
        size="md"
      >
        <Box
          component="form"
          onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            submitEditedPrompt();
          }}
        >
          <JoyDialogContent>
            <JoyTextarea
              autoFocus
              label="Prompt"
              minRows={6}
              maxRows={12}
              value={editedPrompt}
              onValueChange={setEditedPrompt}
              sx={{
                minHeight: 180,
                backgroundColor: "background.surface",
                "&:hover:not([data-disabled='true'])": {
                  backgroundColor: "background.surface",
                },
                "& .MuiTextarea-textarea": {
                  minHeight: 160,
                  resize: "vertical",
                },
              }}
            />
          </JoyDialogContent>
          <JoyDialogActions>
            <JoyButton
              color="neutral"
              size="sm"
              variant="plain"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </JoyButton>
            <JoyButton
              color="primary"
              disabled={!trimmedEditedPrompt}
              size="sm"
              type="submit"
              variant="solid"
              startDecorator={<WandSparkles size={14} strokeWidth={1.9} />}
            >
              Generate
            </JoyButton>
          </JoyDialogActions>
        </Box>
      </JoyDialog>
    </>
  );
}, areImageBlockPropsEqual);

function areImageBlockPropsEqual(
  previous: ImageBlockProps,
  next: ImageBlockProps,
): boolean {
  return (
    previous.url === next.url &&
    previous.alt === next.alt &&
    previous.enhancedPrompt === next.enhancedPrompt &&
    previous.storagePath === next.storagePath &&
    previous.width === next.width &&
    previous.height === next.height
  );
}
