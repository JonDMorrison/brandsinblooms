import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  CheckCircle,
  Globe,
  Loader2,
  Maximize2,
  RotateCcw,
  Send,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import { ImageSelectButton } from "@/components/image";
import { ImageUploader } from "@/lib/image/imageUploader";
import { ImageProcessor, getOptimalFormat } from "@/lib/image/imageProcessor";
import { trackUnsplashDownload } from "@/lib/unsplashAttribution";
import { twilioClient } from "@/lib/sms/twilioClient";
import { CountryCodeSelect } from "./CountryCodeSelect";

interface SMSQuickSendProps {
  onSent: () => void;
}

interface ExternalImageMetadata {
  id?: string;
}

export const SMSQuickSend: React.FC<SMSQuickSendProps> = ({ onSent }) => {
  const [countryCode, setCountryCode] = React.useState("+1");
  const [phone, setPhone] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [processingImage, setProcessingImage] = React.useState(false);
  const [imageStatus, setImageStatus] = React.useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [externalImageUrl, setExternalImageUrl] = React.useState<string | null>(
    null,
  );
  const [externalImageMetadata, setExternalImageMetadata] =
    React.useState<ExternalImageMetadata | null>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [objectFit, setObjectFit] = React.useState<"contain" | "cover">(
    "contain",
  );
  const [showFullScreen, setShowFullScreen] = React.useState(false);

  const processFile = async (file: File) => {
    setExternalImageUrl(null);
    setExternalImageMetadata(null);

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];

    if (!allowedTypes.includes(file.type)) {
      setImageStatus("error");
      toast.error("Only JPG, PNG, and GIF images are supported for MMS");
      return;
    }

    setProcessingImage(true);
    setImageStatus("processing");

    try {
      let processedFile = file;

      if (file.size > 500 * 1024) {
        const processor = new ImageProcessor();
        const processed = await processor.processImage(file, {
          maxDimension: 600,
          quality: 0.7,
          format: getOptimalFormat(file),
        });

        const response = await fetch(processed.optimized);
        const blob = await response.blob();
        processedFile = new File([blob], file.name, { type: blob.type });

        if (processedFile.size > 500 * 1024) {
          setImageStatus("error");
          toast.error(
            "Image is still too large after compression. Please use a smaller image.",
          );
          return;
        }
      }

      setImageFile(processedFile);
      setImageStatus("success");

      const reader = new FileReader();
      reader.onload = (event) =>
        setImagePreview(event.target?.result as string);
      reader.readAsDataURL(processedFile);
    } catch (error) {
      console.error("Image processing error:", error);
      setImageStatus("error");
      toast.error("Failed to process image. Please try a different image.");
    } finally {
      setProcessingImage(false);
    }
  };

  const handleImageSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = "";
    await processFile(file);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(false);

    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageStatus("idle");
    setProcessingImage(false);
    setExternalImageUrl(null);
    setExternalImageMetadata(null);
  };

  const handleExternalImageSelect = async (
    imageUrl: string,
    metadata?: ExternalImageMetadata,
  ) => {
    setImageFile(null);
    setImagePreview(null);
    setImageStatus("idle");
    setProcessingImage(false);
    setExternalImageUrl(imageUrl);
    setExternalImageMetadata(metadata ?? null);
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!phone || !message) {
      toast.error("Please enter both phone number and message");
      return;
    }

    setSending(true);
    setUploading(false);
    try {
      let mediaUrls: string[] = [];

      if (imageFile) {
        setUploading(true);
        const uploader = new ImageUploader("media-mms");
        const result = await uploader.uploadProcessedImage(
          imageFile,
          imageFile.name,
          "-mms-test",
        );
        mediaUrls = [result.publicUrl!];
        setUploading(false);
      } else if (externalImageUrl) {
        mediaUrls = [externalImageUrl];

        if (externalImageMetadata?.id) {
          await trackUnsplashDownload(externalImageMetadata.id).catch(
            () => undefined,
          );
        }
      }

      const fullPhone = `${countryCode}${phone.replace(/^[+\s()-]*/g, "")}`;

      await twilioClient.sendSMS({
        to: fullPhone,
        body: message,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      });

      const hasImage = imageFile || externalImageUrl;
      toast.success(
        hasImage
          ? "Test MMS sent successfully!"
          : "Test SMS sent successfully!",
      );
      setCountryCode("+1");
      setPhone("");
      setMessage("");
      setImageFile(null);
      setImagePreview(null);
      setExternalImageUrl(null);
      setExternalImageMetadata(null);
      setImageStatus("idle");
      onSent();
    } catch (error) {
      console.error("Error sending SMS:", error);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const characterCount = message.length;
  const maxLength = 160;
  const characterTone =
    characterCount > maxLength
      ? "danger.600"
      : characterCount > 140
        ? "warning.600"
        : "neutral.500";
  const previewSource = imagePreview || externalImageUrl || "";
  const hasImage = Boolean(previewSource);
  const statusChip =
    imageStatus === "processing"
      ? {
          color: "warning" as const,
          label: "Processing",
          icon: <Loader2 size={14} className="animate-spin" />,
        }
      : imageStatus === "success"
        ? {
            color: "success" as const,
            label: "Ready",
            icon: <CheckCircle size={14} />,
          }
        : imageStatus === "error"
          ? {
              color: "danger" as const,
              label: "Error",
              icon: <X size={14} />,
            }
          : externalImageUrl
            ? {
                color: "primary" as const,
                label: "Remote image",
                icon: <Globe size={14} />,
              }
            : null;

  return (
    <Stack spacing={2.5} id="quick-send">
      <Stack spacing={0.75}>
        <Typography level="title-md" fontWeight="lg">
          Quick Send
        </Typography>
        <Typography level="body-sm" color="neutral">
          Send a test SMS or MMS instantly without opening the campaign builder.
        </Typography>
      </Stack>

      <Box
        component="form"
        onSubmit={handleSend}
        sx={{ display: "grid", gap: 2.5 }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "164px minmax(0, 1fr)" },
            gap: 1.5,
            alignItems: "end",
          }}
        >
          <Stack spacing={0.75}>
            <Typography level="body-sm" fontWeight="md">
              Country Code
            </Typography>
            <CountryCodeSelect
              value={countryCode}
              onChange={setCountryCode}
              disabled={sending}
              sx={{ minWidth: 0 }}
            />
          </Stack>
          <JoyInput
            id="quick-send-phone"
            type="tel"
            label="Phone Number"
            placeholder="(555) 123-4567"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={sending}
            helperText="Select your country code and enter the destination number."
            sx={{ minHeight: 44, borderRadius: "12px" }}
          />
        </Box>

        <Box sx={{ position: "relative" }}>
          <JoyTextarea
            id="quick-send-message"
            label="Message"
            placeholder="Enter your test message..."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={maxLength}
            minRows={5}
            helperText={
              characterCount > 140
                ? "Approaching the single-message limit."
                : "Test messages are not counted against your quota."
            }
            sx={{ minHeight: 152, borderRadius: "12px", pr: 9, pb: 4 }}
          />
          <Typography
            level="body-xs"
            sx={{
              position: "absolute",
              right: 12,
              bottom: 28,
              color: characterTone,
              fontWeight: "md",
              pointerEvents: "none",
            }}
          >
            {characterCount}/{maxLength}
          </Typography>
        </Box>

        <Stack spacing={1.25}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
              flexWrap: "wrap",
            }}
          >
            <Typography level="body-sm" fontWeight="md">
              Image (Optional)
            </Typography>
            {statusChip ? (
              <Chip
                size="sm"
                variant="soft"
                color={statusChip.color}
                startDecorator={statusChip.icon}
              >
                {statusChip.label}
              </Chip>
            ) : null}
          </Box>

          {hasImage ? (
            <Box
              sx={{
                borderRadius: "16px",
                border: "1px solid",
                borderColor: "neutral.200",
                backgroundColor: "background.surface",
                p: 1.5,
              }}
            >
              <Stack spacing={1.5}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Button
                      type="button"
                      variant="soft"
                      color="neutral"
                      size="sm"
                      startDecorator={<RotateCcw size={14} />}
                      onClick={() =>
                        setObjectFit(
                          objectFit === "contain" ? "cover" : "contain",
                        )
                      }
                      sx={{ borderRadius: "10px" }}
                    >
                      {objectFit === "contain" ? "Fill" : "Fit"}
                    </Button>
                    <Button
                      type="button"
                      variant="soft"
                      color="neutral"
                      size="sm"
                      startDecorator={<Maximize2 size={14} />}
                      onClick={() => setShowFullScreen(true)}
                      sx={{ borderRadius: "10px" }}
                    >
                      View Full
                    </Button>
                  </Stack>
                  <IconButton
                    type="button"
                    variant="soft"
                    color="danger"
                    onClick={handleRemoveImage}
                    disabled={processingImage}
                  >
                    <X size={16} />
                  </IconButton>
                </Box>

                <Box
                  sx={{
                    position: "relative",
                    borderRadius: "12px",
                    backgroundColor: "background.level1",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={previewSource}
                    alt="MMS Preview"
                    style={{
                      display: "block",
                      width: "100%",
                      height: 256,
                      objectFit,
                      cursor: "zoom-in",
                    }}
                    onClick={() => setShowFullScreen(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setShowFullScreen(true);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label="Click to view full size image"
                  />
                  {processingImage ? (
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        backgroundColor: "rgba(0, 0, 0, 0.24)",
                      }}
                    >
                      <Loader2
                        size={24}
                        className="animate-spin"
                        color="white"
                      />
                    </Box>
                  ) : null}
                  {imageFile ? (
                    <Chip
                      size="sm"
                      variant="solid"
                      color="neutral"
                      sx={{ position: "absolute", left: 12, bottom: 12 }}
                    >
                      {Math.round(imageFile.size / 1024)} KB
                    </Chip>
                  ) : null}
                  {externalImageUrl ? (
                    <Chip
                      size="sm"
                      variant="solid"
                      color="primary"
                      startDecorator={<Globe size={12} />}
                      sx={{ position: "absolute", left: 12, bottom: 12 }}
                    >
                      Unsplash
                    </Chip>
                  ) : null}
                </Box>
              </Stack>
            </Box>
          ) : (
            <Box
              sx={{
                borderRadius: "16px",
                border: "2px dashed",
                borderColor: isDragActive ? "success.400" : "neutral.300",
                backgroundColor: isDragActive
                  ? "success.50"
                  : processingImage
                    ? "neutral.100"
                    : "background.level1",
                px: 3,
                py: 4,
                textAlign: "center",
                cursor: processingImage ? "progress" : "pointer",
                transition:
                  "border-color 160ms ease, background-color 160ms ease, opacity 160ms ease",
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={!processingImage ? handleBrowseClick : undefined}
              onKeyDown={(event) => {
                if (
                  (event.key === "Enter" || event.key === " ") &&
                  !processingImage
                ) {
                  event.preventDefault();
                  handleBrowseClick();
                }
              }}
              tabIndex={processingImage ? -1 : 0}
              role="button"
              aria-label="Upload image or drag and drop"
            >
              <Stack spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "14px",
                    display: "grid",
                    placeItems: "center",
                    backgroundColor: "background.surface",
                    color: "neutral.500",
                  }}
                >
                  {processingImage ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Upload size={18} />
                  )}
                </Box>
                <Stack spacing={0.5}>
                  <Typography level="body-sm" fontWeight="md">
                    {processingImage
                      ? "Processing image..."
                      : isDragActive
                        ? "Drop to upload"
                        : "Upload image for MMS"}
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    Drag and drop or click to browse. Large images are optimized
                    automatically.
                  </Typography>
                </Stack>
              </Stack>
            </Box>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              type="button"
              variant="outlined"
              color="neutral"
              onClick={handleBrowseClick}
              disabled={processingImage}
              startDecorator={<Upload size={15} />}
              sx={{ borderRadius: "12px", alignSelf: "flex-start" }}
            >
              Upload Image
            </Button>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <ImageSelectButton
                onImageSelect={handleExternalImageSelect}
                contentContext={message || "MMS image"}
                buttonText="Browse Free Images"
                mode="modal"
                compact
              />
            </Box>
          </Stack>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif"
            onChange={handleImageSelect}
            className="hidden"
            aria-hidden="true"
          />

          <Typography level="body-xs" color="neutral">
            Upload your own image or browse free images from Unsplash. Large
            images are automatically optimized for MMS.
          </Typography>
        </Stack>

        <Button
          type="submit"
          disabled={
            sending || uploading || processingImage || !phone || !message
          }
          size="lg"
          startDecorator={
            sending || uploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )
          }
          sx={{ borderRadius: "12px" }}
        >
          {processingImage
            ? "Processing Image..."
            : uploading
              ? "Uploading Image..."
              : sending
                ? "Sending..."
                : hasImage
                  ? "Send Test MMS"
                  : "Send Test SMS"}
        </Button>
      </Box>

      <Modal open={showFullScreen} onClose={() => setShowFullScreen(false)}>
        <ModalDialog
          layout="center"
          sx={{
            maxWidth: "min(960px, calc(100vw - 32px))",
            width: "100%",
            p: 1.5,
            backgroundColor: "background.body",
          }}
        >
          <ModalClose />
          <Box
            sx={{
              display: "grid",
              placeItems: "center",
              minHeight: { xs: 280, md: 520 },
              borderRadius: "12px",
              overflow: "hidden",
              backgroundColor: "background.level1",
            }}
          >
            {previewSource ? (
              <img
                src={previewSource}
                alt="MMS Preview - Full Size"
                style={{
                  display: "block",
                  width: "100%",
                  maxHeight: "75vh",
                  objectFit: "contain",
                }}
              />
            ) : null}
          </Box>
        </ModalDialog>
      </Modal>
    </Stack>
  );
};
