import * as React from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useDropzone } from "react-dropzone";
import {
  AlertCircle,
  CheckCircle,
  ImagePlus,
  Loader2,
  Send,
  X,
} from "lucide-react";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SendATextCardProps {
  onSent?: () => void;
}

const DEFAULT_MESSAGE =
  "BloomSuite: Thanks for stopping by our booth. This is a live demo text sent in real time.";

const BLOCKED_SHORTENERS = [
  "bit.ly",
  "bitly.com",
  "tinyurl.com",
  "t.co",
  "rebrand.ly",
  "shorturl.at",
  "is.gd",
  "goo.gl",
  "ow.ly",
  "buff.ly",
];

function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function containsBlockedShortener(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  for (const shortener of BLOCKED_SHORTENERS) {
    if (lowerMessage.includes(shortener)) return shortener;
  }
  return null;
}

export function SendATextCard({ onSent }: SendATextCardProps) {
  const { toast } = useToast();
  const [phone, setPhone] = React.useState("");
  const [message, setMessage] = React.useState(DEFAULT_MESSAGE);
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [result, setResult] = React.useState<{
    success: boolean;
    message: string;
    messageId?: string;
  } | null>(null);

  React.useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const onDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload JPG, PNG, or WebP",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum 5MB allowed",
          variant: "destructive",
        });
        return;
      }

      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }

      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    },
    [imagePreview, toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxFiles: 1,
    multiple: false,
  });

  const removeImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
  };

  const handlePhoneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(raw);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `demo-sms/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("media-mms")
      .upload(fileName, file, { contentType: file.type, upsert: false });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from("media-mms")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSend = async () => {
    setResult(null);

    if (phone.length !== 10) {
      setResult({
        success: false,
        message: "Please enter a valid 10-digit US/CA phone number",
      });
      return;
    }

    if (!message.trim()) {
      setResult({ success: false, message: "Message cannot be empty" });
      return;
    }

    const blockedShortener = containsBlockedShortener(message);
    if (blockedShortener) {
      setResult({
        success: false,
        message: `Blocked URL shortener detected: ${blockedShortener}. Please use full URLs.`,
      });
      return;
    }

    setSending(true);

    try {
      let mediaUrl: string | undefined;

      if (imageFile) {
        setUploading(true);
        try {
          mediaUrl = await uploadImage(imageFile);
        } catch (error) {
          setResult({
            success: false,
            message:
              error instanceof Error ? error.message : "Image upload failed",
          });
          setSending(false);
          setUploading(false);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke("send-demo-sms", {
        body: { phone, message, mediaUrl },
      });

      if (error) {
        throw new Error(error.message || "Failed to send");
      }

      if (data.success) {
        setResult({
          success: true,
          message: "Sent successfully!",
          messageId: data.messageId,
        });
        toast({
          title: "✓ Text sent!",
          description: `Message delivered to +1${phone}`,
        });
        onSent?.();
      } else {
        setResult({ success: false, message: data.error || "Failed to send" });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setResult({ success: false, message: errorMessage });
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const messageWithOptOut = message.toLowerCase().includes("stop")
    ? message
    : `${message.trim()}\n\nReply STOP to opt out.`;
  const segmentCount = Math.max(1, Math.ceil(message.length / 160));
  const characterTone =
    message.length > 160
      ? "danger.600"
      : message.length > 140
        ? "warning.600"
        : "neutral.500";

  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.75}>
        <Typography level="title-md" fontWeight="lg">
          Send Text
        </Typography>
        <Typography level="body-sm" color="neutral">
          Send a live demo text message in real time.
        </Typography>
      </Stack>

      <JoyInput
        id="send-text-phone"
        type="tel"
        label="Phone Number (US/CA)"
        placeholder="(555) 123-4567"
        value={formatPhoneDisplay(phone)}
        onChange={handlePhoneChange}
        disabled={sending}
        startDecorator={
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <span aria-hidden="true">🇺🇸</span>
            <Typography level="body-sm" fontWeight="md">
              +1
            </Typography>
          </Box>
        }
        helperText="US and Canada demo numbers only."
        sx={{ minHeight: 44, borderRadius: "12px" }}
      />

      <Box sx={{ position: "relative" }}>
        <JoyTextarea
          id="send-text-message"
          label="Message"
          placeholder="Type your message..."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={5}
          disabled={sending}
          helperText="Opt-out text is appended automatically if it is not already present."
          sx={{ minHeight: 156, borderRadius: "12px", pr: 10, pb: 4 }}
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
          {message.length}/160
          {segmentCount > 1 ? ` · ${segmentCount} segments` : ""}
        </Typography>
      </Box>

      <Stack spacing={1}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
          }}
        >
          <Typography level="body-sm" fontWeight="md">
            Image (Optional)
          </Typography>
          {imageFile ? (
            <Chip size="sm" variant="soft" color="neutral">
              {Math.round(imageFile.size / 1024)} KB
            </Chip>
          ) : null}
        </Box>

        {!imagePreview ? (
          <Box
            {...getRootProps()}
            sx={{
              borderRadius: "16px",
              border: "2px dashed",
              borderColor: isDragActive ? "success.400" : "neutral.300",
              backgroundColor: isDragActive
                ? "success.50"
                : "background.level1",
              px: 3,
              py: 4,
              textAlign: "center",
              cursor: sending ? "not-allowed" : "pointer",
              opacity: sending ? 0.5 : 1,
              transition:
                "border-color 160ms ease, background-color 160ms ease, opacity 160ms ease",
            }}
          >
            <input {...getInputProps()} disabled={sending} />
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
                <ImagePlus size={18} />
              </Box>
              <Stack spacing={0.5}>
                <Typography level="body-sm" fontWeight="md">
                  {isDragActive
                    ? "Drop image here"
                    : "Drag and drop or click to upload"}
                </Typography>
                <Typography level="body-xs" color="neutral">
                  JPG, PNG, WebP up to 5MB.
                </Typography>
              </Stack>
            </Stack>
          </Box>
        ) : (
          <Box
            sx={{
              position: "relative",
              overflow: "hidden",
              borderRadius: "16px",
              border: "1px solid",
              borderColor: "neutral.200",
              backgroundColor: "background.surface",
              p: 1.5,
            }}
          >
            <img
              src={imagePreview}
              alt="Preview"
              style={{
                display: "block",
                width: "100%",
                height: 192,
                objectFit: "cover",
                borderRadius: 12,
              }}
            />
            <IconButton
              type="button"
              variant="solid"
              color="danger"
              size="sm"
              sx={{ position: "absolute", right: 18, top: 18 }}
              onClick={removeImage}
              disabled={sending}
            >
              <X size={16} />
            </IconButton>
          </Box>
        )}
      </Stack>

      {message && !message.toLowerCase().includes("stop") ? (
        <Box
          sx={{
            borderRadius: "16px",
            border: "1px solid",
            borderColor: "neutral.200",
            backgroundColor: "background.level1",
            p: 2,
          }}
        >
          <Stack spacing={0.75}>
            <Typography level="body-sm" fontWeight="md">
              Preview with opt-out
            </Typography>
            <Typography
              level="body-xs"
              color="neutral"
              sx={{ whiteSpace: "pre-wrap" }}
            >
              {messageWithOptOut}
            </Typography>
          </Stack>
        </Box>
      ) : null}

      <Button
        onClick={handleSend}
        disabled={sending || phone.length !== 10}
        size="lg"
        startDecorator={
          sending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )
        }
        sx={{ borderRadius: "12px" }}
      >
        {sending
          ? uploading
            ? "Uploading image..."
            : "Sending..."
          : "Send Text"}
      </Button>

      {result ? (
        <Alert
          color={result.success ? "success" : "danger"}
          variant="soft"
          startDecorator={
            result.success ? (
              <CheckCircle size={18} />
            ) : (
              <AlertCircle size={18} />
            )
          }
          sx={{ alignItems: "flex-start", borderRadius: "16px" }}
        >
          <Box>
            <Typography level="body-sm" fontWeight="md">
              {result.message}
            </Typography>
            {result.messageId ? (
              <Typography level="body-xs" sx={{ mt: 0.5 }}>
                Message ID: {result.messageId}
              </Typography>
            ) : null}
          </Box>
        </Alert>
      ) : null}
    </Stack>
  );
}
