import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  Send,
  X,
  CheckCircle,
  Loader2,
  Globe,
  Upload,
  Maximize2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { twilioClient } from "@/lib/sms/twilioClient";
import { ImageUploader } from "@/lib/image/imageUploader";
import { ImageProcessor, getOptimalFormat } from "@/lib/image/imageProcessor";
import { ImageSelectButton } from "@/components/image";
import { trackUnsplashDownload } from "@/lib/unsplashAttribution";
import { CountryCodeSelect } from "./CountryCodeSelect";

interface SMSQuickSendProps {
  onSent: () => void;
}

interface ExternalImageMetadata {
  id?: string;
}

export const SMSQuickSend: React.FC<SMSQuickSendProps> = ({ onSent }) => {
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [imageStatus, setImageStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  // External image state
  const [externalImageUrl, setExternalImageUrl] = useState<string | null>(null);
  const [externalImageMetadata, setExternalImageMetadata] =
    useState<ExternalImageMetadata | null>(null);
  // Drag and drop state
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Image preview controls
  const [objectFit, setObjectFit] = useState<"contain" | "cover">("contain");
  const [showFullScreen, setShowFullScreen] = useState(false);

  const processFile = async (file: File) => {
    // Clear external image if local file is selected
    setExternalImageUrl(null);
    setExternalImageMetadata(null);

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];

    // Check if file type is supported
    if (!allowedTypes.includes(file.type)) {
      setImageStatus("error");
      toast.error("Only JPG, PNG, and GIF images are supported for MMS");
      return;
    }

    setProcessingImage(true);
    setImageStatus("processing");

    try {
      let processedFile = file;

      // If file is too large, compress it automatically
      if (file.size > 500 * 1024) {
        const processor = new ImageProcessor();
        const processed = await processor.processImage(file, {
          maxDimension: 600, // Smaller dimension for MMS
          quality: 0.7, // Lower quality for smaller size
          format: getOptimalFormat(file),
        });

        // Convert blob URL to File object
        const response = await fetch(processed.optimized);
        const blob = await response.blob();
        processedFile = new File([blob], file.name, { type: blob.type });

        // Check if compression worked
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

      // Generate preview
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(processedFile);
    } catch (error) {
      console.error("Image processing error:", error);
      setImageStatus("error");
      toast.error("Failed to process image. Please try a different image.");
    } finally {
      setProcessingImage(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input to allow selecting the same file again
    e.target.value = "";

    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
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
    // Also clear external image
    setExternalImageUrl(null);
    setExternalImageMetadata(null);
  };

  const handleExternalImageSelect = async (
    imageUrl: string,
    metadata?: ExternalImageMetadata,
  ) => {
    // Clear local image if external is selected
    setImageFile(null);
    setImagePreview(null);
    setImageStatus("idle");
    setProcessingImage(false);

    // Set external image
    setExternalImageUrl(imageUrl);
    setExternalImageMetadata(metadata);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone || !message) {
      toast.error("Please enter both phone number and message");
      return;
    }

    setSending(true);
    try {
      let mediaUrls: string[] = [];

      // Handle image - either local file or external URL
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

        // Track Unsplash download if it's an Unsplash image
        if (externalImageMetadata?.id) {
          await trackUnsplashDownload(externalImageMetadata.id).catch(
            () => undefined,
          );
        }
      }

      // Combine country code with phone number
      const fullPhone = `${countryCode}${phone.replace(/^[+\s()-]*/g, "")}`;

      // Send SMS using TwilioClient
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
  const characterToneClassName =
    characterCount > maxLength
      ? "text-red-500"
      : characterCount > 140
        ? "text-amber-500"
        : "text-gray-400";

  return (
    <div id="quick-send" className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-gray-900">Quick Send</h3>
        <p className="text-sm text-gray-500">
          Send a test SMS or MMS instantly without opening the campaign builder.
        </p>
      </div>

      <form onSubmit={handleSend} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="quick-send-phone">Phone Number</Label>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-stretch">
              <CountryCodeSelect
                value={countryCode}
                onChange={setCountryCode}
                disabled={sending}
                className="w-full rounded-none border-0 border-b border-gray-200 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:w-[148px] sm:border-b-0 sm:border-r"
              />
              <input
                id="quick-send-phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={sending}
                className="h-12 flex-1 border-0 bg-transparent px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Select your country code and enter the destination number.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quick-send-message">Message</Label>
          <div className="relative">
            <Textarea
              id="quick-send-message"
              placeholder="Enter your test message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[132px] resize-y rounded-xl border-gray-200 bg-white pb-10 pr-24 shadow-sm"
              maxLength={maxLength}
            />
            <div
              className={`pointer-events-none absolute bottom-3 right-3 text-xs font-medium ${characterToneClassName}`}
            >
              {characterCount}/{maxLength}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <p>Test messages are not counted against your quota.</p>
            {characterCount > 140 ? (
              <span>Approaching the single-message limit</span>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label>Image (Optional)</Label>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {imageStatus !== "idle" && (
                <div className="flex items-center space-x-1">
                  {imageStatus === "processing" && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Processing...</span>
                    </>
                  )}
                  {imageStatus === "success" && (
                    <>
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span className="text-green-600">Ready</span>
                    </>
                  )}
                  {imageStatus === "error" && (
                    <>
                      <X className="h-3 w-3 text-red-600" />
                      <span className="text-red-600">Error</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {imagePreview || externalImageUrl ? (
            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setObjectFit(objectFit === "contain" ? "cover" : "contain")
                  }
                  className="h-8 rounded-xl text-xs"
                  aria-pressed={objectFit === "cover"}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {objectFit === "contain" ? "Fill" : "Fit"}
                </Button>
                <Dialog open={showFullScreen} onOpenChange={setShowFullScreen}>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-xl text-xs"
                    >
                      <Maximize2 className="h-3 w-3 mr-1" />
                      View Full
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] max-w-4xl p-2">
                    <div className="flex h-full items-center justify-center">
                      <img
                        src={imagePreview || externalImageUrl || ""}
                        alt="MMS Preview - Full Size"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleRemoveImage}
                  className="h-8 rounded-xl"
                  disabled={processingImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="relative">
                <img
                  src={imagePreview || externalImageUrl || ""}
                  alt="MMS Preview"
                  className={`h-40 w-full cursor-zoom-in rounded-lg bg-gray-50 transition-opacity sm:h-52 md:h-64 ${
                    objectFit === "contain" ? "object-contain" : "object-cover"
                  } ${processingImage ? "opacity-50" : "opacity-100"}`}
                  onClick={() => setShowFullScreen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setShowFullScreen(true);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Click to view full size image"
                />
                {processingImage ? (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                ) : null}
                {imageFile ? (
                  <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
                    {Math.round(imageFile.size / 1024)}KB
                  </div>
                ) : null}
                {externalImageUrl ? (
                  <div className="absolute bottom-2 left-2 flex items-center space-x-1 rounded bg-black/70 px-2 py-1 text-xs text-white">
                    <Globe className="h-3 w-3" />
                    <span>Unsplash</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div
              className={`w-full rounded-xl border-2 border-dashed p-6 text-center transition-colors duration-200 ${
                isDragActive
                  ? "cursor-copy border-emerald-400 bg-emerald-50"
                  : processingImage
                    ? "border-gray-200 bg-gray-100"
                    : "cursor-pointer border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={!processingImage ? handleBrowseClick : undefined}
              tabIndex={processingImage ? -1 : 0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (!processingImage) handleBrowseClick();
                }
              }}
              role="button"
              aria-label="Upload image or drag and drop"
            >
              {processingImage ? (
                <div className="space-y-3">
                  <Loader2 className="mx-auto h-10 w-10 animate-spin text-gray-400" />
                  <p className="text-sm font-medium text-gray-600">
                    Processing image...
                  </p>
                </div>
              ) : isDragActive ? (
                <div className="space-y-3">
                  <Upload className="mx-auto h-10 w-10 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-emerald-700">
                      Drop to upload
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      JPG, PNG, GIF up to 500KB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="mx-auto h-10 w-10 text-gray-400" />
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-700">
                      Upload image for MMS
                    </p>
                    <p className="text-xs text-gray-500">
                      Drag and drop or click to browse. Large images are
                      optimized automatically.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBrowseClick}
              disabled={processingImage}
              className="h-9 rounded-xl border-gray-200 px-4 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Image
            </Button>
            <div>
              <ImageSelectButton
                onImageSelect={handleExternalImageSelect}
                contentContext={message || "MMS image"}
                buttonText="Browse Free Images"
                mode="modal"
                compact
              />
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif"
            onChange={handleImageSelect}
            className="hidden"
            aria-hidden="true"
          />

          <p className="text-xs text-gray-500">
            Upload your own image or browse free images from Unsplash. Large
            images are automatically optimized for MMS.
          </p>
        </div>

        <Button
          type="submit"
          disabled={
            sending || uploading || processingImage || !phone || !message
          }
          className="h-11 w-full rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
        >
          <Send className="h-4 w-4 mr-2" />
          {processingImage
            ? "Processing Image..."
            : uploading
              ? "Uploading Image..."
              : sending
                ? "Sending..."
                : imageFile || externalImageUrl
                  ? "Send Test MMS"
                  : "Send Test SMS"}
        </Button>
      </form>
    </div>
  );
};
