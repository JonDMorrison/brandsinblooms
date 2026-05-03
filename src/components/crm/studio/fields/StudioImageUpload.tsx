import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const CAMPAIGN_IMAGE_BUCKET = "campaign-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

type StudioImageUploadProps = {
  label: string;
  compact?: boolean;
  defaultFilled?: boolean;
  emptyText?: string;
  height?: number | string;
  value?: string;
  onChange?: (url: string) => void;
};

function getSafeExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  switch (file.type) {
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

function validateFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Use a JPG, PNG, GIF, or WebP image.";
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return "Image must be 5MB or smaller.";
  }

  return null;
}

export async function uploadStudioImageFile(file: File) {
  const validationError = validateFile(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const userId = userData.user?.id;

  if (!userId) {
    throw new Error("Sign in to upload campaign images.");
  }

  const extension = getSafeExtension(file);
  const fileName = `${userId}/studio/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(CAMPAIGN_IMAGE_BUCKET)
    .upload(fileName, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: urlData } = supabase.storage
    .from(CAMPAIGN_IMAGE_BUCKET)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

export default function StudioImageUpload({
  label,
  defaultFilled = false,
  emptyText = "Upload image",
  height,
  value,
  onChange,
}: StudioImageUploadProps) {
  const [internalUrl, setInternalUrl] = React.useState(
    defaultFilled ? "preview" : "",
  );
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const lastFileRef = React.useRef<File | null>(null);
  const resolvedHeight = height ?? 88;
  const resolvedUrl = value ?? internalUrl;
  const hasPreview = Boolean(resolvedUrl);

  const setResolvedUrl = React.useCallback(
    (nextUrl: string) => {
      if (value === undefined) {
        setInternalUrl(nextUrl);
      }

      onChange?.(nextUrl);
    },
    [onChange, value],
  );

  const uploadFile = React.useCallback(
    async (file: File) => {
      lastFileRef.current = file;
      setErrorMessage(null);
      setIsUploading(true);
      setProgress(18);

      try {
        setProgress(42);
        const publicUrl = await uploadStudioImageFile(file);
        setProgress(78);
        setResolvedUrl(publicUrl);
        setProgress(100);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed.";
        setErrorMessage(message);
      } finally {
        window.setTimeout(() => {
          setIsUploading(false);
          setProgress(0);
        }, 240);

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [setResolvedUrl],
  );

  const handleFiles = React.useCallback(
    (files: FileList | null) => {
      const file = files?.[0];

      if (!file) {
        return;
      }

      void uploadFile(file);
    },
    [uploadFile],
  );

  return (
    <Stack spacing={0.5} sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      <Typography
        level="body-xs"
        sx={{
          maxWidth: "100%",
          fontSize: "12px",
          fontWeight: 650,
          letterSpacing: "0.01em",
          color: "neutral.700",
        }}
      >
        {label}
      </Typography>
      <Sheet
        variant="plain"
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragActive(false);
          handleFiles(event.dataTransfer.files);
        }}
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          border: "1.5px dashed",
          borderColor: isDragActive ? "primary.400" : "neutral.200",
          borderRadius: "10px",
          overflow: "hidden",
          height: resolvedHeight,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: hasPreview
            ? "neutral.100"
            : isDragActive
              ? "primary.50"
              : "neutral.50",
          transition:
            "border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
          "&:hover:not(:focus-visible)": {
            borderColor: "primary.400",
            bgcolor: hasPreview ? "neutral.100" : "primary.50",
            "& .studio-image-actions": { opacity: 1 },
            "& .studio-image-empty-icon": { color: "primary.500" },
          },
          "&:focus-visible": {
            borderColor: "primary.400",
            boxShadow: "0 0 0 3px var(--joy-palette-primary-100)",
            outline: "none",
          },
        }}
      >
        <Box
          component="input"
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            handleFiles(event.target.files)
          }
          sx={{ display: "none" }}
        />
        {hasPreview ? (
          <>
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  resolvedUrl === "preview"
                    ? "linear-gradient(135deg, rgba(15,23,42,0.18), rgba(15,23,42,0.08))"
                    : `url(${resolvedUrl}) center / cover no-repeat`,
                backgroundSize: "cover",
              }}
            />
            <Stack
              className="studio-image-actions"
              direction="row"
              spacing={0.5}
              sx={{
                position: "absolute",
                inset: 0,
                zIndex: 1,
                alignItems: "center",
                justifyContent: "center",
                flexWrap: "wrap",
                alignContent: "center",
                px: 0.5,
                bgcolor: "rgba(15,23,42,0.38)",
                opacity: 0,
                transition: "opacity 120ms ease",
              }}
            >
              <Button
                size="sm"
                variant="soft"
                color="neutral"
                startDecorator={<Camera size={13} />}
                onClick={(event) => {
                  event.stopPropagation();
                  fileInputRef.current?.click();
                }}
                sx={{
                  maxWidth: "100%",
                  fontSize: "11px",
                  fontWeight: 700,
                  minHeight: 28,
                  borderRadius: "8px",
                  bgcolor: "rgba(255,255,255,0.92)",
                  color: "neutral.800",
                  "&:hover": { bgcolor: "#ffffff", color: "primary.700" },
                }}
              >
                Replace
              </Button>
              <Button
                size="sm"
                variant="soft"
                color="neutral"
                startDecorator={<Trash2 size={13} />}
                onClick={(event) => {
                  event.stopPropagation();
                  setResolvedUrl("");
                  setErrorMessage(null);
                }}
                sx={{
                  maxWidth: "100%",
                  fontSize: "11px",
                  fontWeight: 700,
                  minHeight: 28,
                  borderRadius: "8px",
                  bgcolor: "rgba(255,255,255,0.92)",
                  color: "neutral.800",
                  "&:hover": { bgcolor: "#ffffff", color: "danger.600" },
                }}
              >
                Remove
              </Button>
            </Stack>
          </>
        ) : (
          <Stack
            spacing={0.5}
            alignItems="center"
            sx={{ px: 1, textAlign: "center", width: "100%", maxWidth: "100%" }}
          >
            <Box
              className="studio-image-empty-icon"
              sx={{
                color: isDragActive ? "primary.500" : "neutral.300",
                display: "flex",
                transition: "color 140ms ease, transform 140ms ease",
                transform: isDragActive ? "translateY(-1px)" : "none",
              }}
            >
              <ImagePlus size={20} />
            </Box>
            <Typography
              level="body-xs"
              sx={{
                color: isDragActive ? "primary.700" : "neutral.500",
                fontSize: "11px",
                fontWeight: 650,
                maxWidth: "100%",
                wordBreak: "break-word",
              }}
            >
              {isDragActive
                ? "Drop to upload"
                : emptyText === "Upload image"
                  ? "Upload"
                  : emptyText}
            </Typography>
          </Stack>
        )}
        {isUploading ? (
          <LinearProgress
            color="primary"
            determinate
            value={progress}
            size="sm"
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 0,
              "--LinearProgress-thickness": "3px",
              "--LinearProgress-progressColor":
                "var(--joy-palette-primary-400)",
              bgcolor: "primary.100",
            }}
          />
        ) : null}
      </Sheet>
      {errorMessage ? (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <Typography
            level="body-xs"
            sx={{
              color: "danger.600",
              flex: 1,
              minWidth: 0,
              wordBreak: "break-word",
            }}
          >
            {errorMessage}
          </Typography>
          {lastFileRef.current ? (
            <Button
              size="sm"
              variant="plain"
              color="danger"
              onClick={() => {
                if (lastFileRef.current) {
                  void uploadFile(lastFileRef.current);
                }
              }}
              sx={{ minHeight: 24, fontSize: "11px", flexShrink: 0 }}
            >
              Retry
            </Button>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
