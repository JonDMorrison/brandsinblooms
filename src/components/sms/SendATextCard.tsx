import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Send,
  Upload,
  X,
} from "lucide-react";
import { useDropzone } from "react-dropzone";

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
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    messageId?: string;
  } | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
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
      }
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
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(raw);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `demo-sms/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("media-mms")
      .upload(fileName, file, { contentType: file.type, upsert: false });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data: urlData } = supabase.storage
      .from("media-mms")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSend = async () => {
    setResult(null);

    // Validation
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

      // Upload image if present
      if (imageFile) {
        setUploading(true);
        try {
          mediaUrl = await uploadImage(imageFile);
        } catch (err) {
          setResult({
            success: false,
            message: err instanceof Error ? err.message : "Image upload failed",
          });
          setSending(false);
          setUploading(false);
          return;
        }
        setUploading(false);
      }

      // Call edge function
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setResult({ success: false, message: errorMessage });
    } finally {
      setSending(false);
    }
  };

  const messageWithOptOut = message.toLowerCase().includes("stop")
    ? message
    : `${message.trim()}\n\nReply STOP to opt out.`;
  const segmentCount = Math.max(1, Math.ceil(message.length / 160));
  const characterToneClassName =
    message.length > 160
      ? "text-red-500"
      : message.length > 140
        ? "text-amber-500"
        : "text-gray-400";

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-gray-900">Send Text</h3>
        <p className="text-sm text-gray-500">
          Send a live demo text message in real time.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="send-text-phone">Phone Number (US/CA)</Label>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col sm:flex-row">
            <div className="flex h-12 items-center gap-2 border-b border-gray-200 px-4 text-sm font-medium text-gray-700 sm:w-[148px] sm:border-b-0 sm:border-r">
              <span className="text-base">🇺🇸</span>
              +1
            </div>
            <input
              id="send-text-phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={formatPhoneDisplay(phone)}
              onChange={handlePhoneChange}
              disabled={sending}
              className="h-12 flex-1 border-0 bg-transparent px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="send-text-message">Message</Label>
        <div className="relative">
          <Textarea
            id="send-text-message"
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            disabled={sending}
            className="min-h-[136px] resize-y rounded-xl border-gray-200 bg-white pb-10 pr-24 shadow-sm"
          />
          <div
            className={`pointer-events-none absolute bottom-3 right-3 text-xs font-medium ${characterToneClassName}`}
          >
            {message.length}/160
            {segmentCount > 1 ? ` · ${segmentCount} segments` : ""}
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Opt-out text is appended automatically if it is not already present.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Image (Optional)</Label>
        {!imagePreview ? (
          <div
            {...getRootProps()}
            className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
              isDragActive
                ? "border-emerald-400 bg-emerald-50"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            } ${sending ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
          >
            <input {...getInputProps()} disabled={sending} />
            <Upload className="mx-auto mb-3 h-6 w-6 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">
              {isDragActive
                ? "Drop image here…"
                : "Drag & drop or click to upload"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              JPG, PNG, WebP · Max 5MB
            </p>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-32 w-full rounded-lg object-cover"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute right-5 top-5 h-8 w-8 rounded-full"
              onClick={removeImage}
              disabled={sending}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {message && !message.toLowerCase().includes("stop") && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
          <p className="mb-1 font-medium text-gray-900">Preview with opt-out</p>
          <p className="whitespace-pre-wrap">{messageWithOptOut}</p>
        </div>
      )}

      <Button
        onClick={handleSend}
        disabled={sending || phone.length !== 10}
        className="h-11 w-full rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
      >
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            {uploading ? "Uploading image..." : "Sending..."}
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Send Text
          </>
        )}
      </Button>

      {result && (
        <div
          className={`flex items-start gap-2 rounded-2xl border p-3 ${
            result.success
              ? "border-green-200 bg-green-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          {result.success ? (
            <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          )}
          <div>
            <p
              className={`font-medium ${result.success ? "text-green-800" : "text-red-800"}`}
            >
              {result.message}
            </p>
            {result.messageId && (
              <p className="mt-1 text-xs text-green-700">
                Message ID: {result.messageId}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
