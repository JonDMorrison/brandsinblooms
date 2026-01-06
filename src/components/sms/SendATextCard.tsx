import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Send, Image, X, CheckCircle, AlertCircle, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const DEFAULT_MESSAGE = "BloomSuite: Thanks for stopping by our booth. This is a live demo text sent in real time.";

const BLOCKED_SHORTENERS = [
  "bit.ly", "bitly.com", "tinyurl.com", "t.co", "rebrand.ly", 
  "shorturl.at", "is.gd", "goo.gl", "ow.ly", "buff.ly"
];

function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, '');
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

export function SendATextCard() {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; messageId?: string } | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast({ title: 'Invalid file type', description: 'Please upload JPG, PNG, or WebP', variant: 'destructive' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Maximum 5MB allowed', variant: 'destructive' });
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    maxFiles: 1,
    multiple: false,
  });

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(raw);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `demo-sms/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    
    const { error } = await supabase.storage
      .from('media-mms')
      .upload(fileName, file, { contentType: file.type, upsert: false });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data: urlData } = supabase.storage
      .from('media-mms')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSend = async () => {
    setResult(null);

    // Validation
    if (phone.length !== 10) {
      setResult({ success: false, message: 'Please enter a valid 10-digit US/CA phone number' });
      return;
    }

    if (!message.trim()) {
      setResult({ success: false, message: 'Message cannot be empty' });
      return;
    }

    const blockedShortener = containsBlockedShortener(message);
    if (blockedShortener) {
      setResult({ success: false, message: `Blocked URL shortener detected: ${blockedShortener}. Please use full URLs.` });
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
          setResult({ success: false, message: err instanceof Error ? err.message : 'Image upload failed' });
          setSending(false);
          setUploading(false);
          return;
        }
        setUploading(false);
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke('send-demo-sms', {
        body: { phone, message, mediaUrl }
      });

      if (error) {
        throw new Error(error.message || 'Failed to send');
      }

      if (data.success) {
        setResult({ 
          success: true, 
          message: 'Sent successfully!', 
          messageId: data.messageId 
        });
        toast({ title: '✓ Text sent!', description: `Message delivered to +1${phone}` });
      } else {
        setResult({ success: false, message: data.error || 'Failed to send' });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setResult({ success: false, message: errorMessage });
    } finally {
      setSending(false);
    }
  };

  const messageWithOptOut = message.toLowerCase().includes('stop') 
    ? message 
    : `${message.trim()}\n\nReply STOP to opt out.`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Send A Text
        </CardTitle>
        <CardDescription>
          Send a live demo text message in real time
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phone Input */}
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number (US/CA)</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="(555) 123-4567"
            value={formatPhoneDisplay(phone)}
            onChange={handlePhoneChange}
            disabled={sending}
          />
        </div>

        {/* Message Textarea */}
        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            placeholder="Enter your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            disabled={sending}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            {message.length} characters • Opt-out will be appended if not present
          </p>
        </div>

        {/* Image Upload */}
        <div className="space-y-2">
          <Label>Image (optional)</Label>
          {!imagePreview ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              } ${sending ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <input {...getInputProps()} disabled={sending} />
              <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isDragActive ? 'Drop image here...' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP • Max 5MB</p>
            </div>
          ) : (
            <div className="relative inline-block">
              <img 
                src={imagePreview} 
                alt="Preview" 
                className="h-24 w-24 object-cover rounded-lg border"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6"
                onClick={removeImage}
                disabled={sending}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Preview of final message */}
        {message && !message.toLowerCase().includes('stop') && (
          <div className="text-xs bg-muted/50 p-2 rounded border">
            <p className="font-medium mb-1">Preview (with auto opt-out):</p>
            <p className="whitespace-pre-wrap text-muted-foreground">{messageWithOptOut}</p>
          </div>
        )}

        {/* Send Button */}
        <Button 
          onClick={handleSend} 
          disabled={sending || phone.length !== 10}
          className="w-full"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {uploading ? 'Uploading image...' : 'Sending...'}
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send Text
            </>
          )}
        </Button>

        {/* Result Area */}
        {result && (
          <div className={`flex items-start gap-2 p-3 rounded-lg ${
            result.success 
              ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
          }`}>
            {result.success ? (
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className={`font-medium ${result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                {result.message}
              </p>
              {result.messageId && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Message ID: {result.messageId}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
