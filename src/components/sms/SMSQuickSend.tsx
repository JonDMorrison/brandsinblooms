import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Send, Zap, Image, X, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { twilioClient } from '@/lib/sms/twilioClient';
import { ImageUploader } from '@/lib/image/imageUploader';
import { ImageProcessor, getOptimalFormat } from '@/lib/image/imageProcessor';

interface SMSQuickSendProps {
  onSent: () => void;
}

export const SMSQuickSend: React.FC<SMSQuickSendProps> = ({ onSent }) => {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [imageStatus, setImageStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input to allow selecting the same file again
    e.target.value = '';

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    
    // Check if file type is supported
    if (!allowedTypes.includes(file.type)) {
      setImageStatus('error');
      toast.error('Only JPG, PNG, and GIF images are supported for MMS');
      return;
    }

    setProcessingImage(true);
    setImageStatus('processing');
    toast.info('Processing image...');

    try {
      let processedFile = file;
      
      // If file is too large, compress it automatically
      if (file.size > 500 * 1024) {
        toast.info('Image is too large, compressing automatically...');
        
        const processor = new ImageProcessor();
        const processed = await processor.processImage(file, {
          maxDimension: 600, // Smaller dimension for MMS
          quality: 0.7, // Lower quality for smaller size
          format: getOptimalFormat(file)
        });

        // Convert blob URL to File object
        const response = await fetch(processed.optimized);
        const blob = await response.blob();
        processedFile = new File([blob], file.name, { type: blob.type });

        // Check if compression worked
        if (processedFile.size > 500 * 1024) {
          setImageStatus('error');
          toast.error('Image is still too large after compression. Please use a smaller image.');
          return;
        }
        
        toast.success(`Image optimized: ${Math.round(file.size / 1024)}KB → ${Math.round(processedFile.size / 1024)}KB`);
      } else {
        toast.success('Image ready for MMS');
      }

      setImageFile(processedFile);
      setImageStatus('success');
      
      // Generate preview
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(processedFile);
      
    } catch (error) {
      console.error('Image processing error:', error);
      setImageStatus('error');
      toast.error('Failed to process image. Please try a different image.');
    } finally {
      setProcessingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageStatus('idle');
    setProcessingImage(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone || !message) {
      toast.error('Please enter both phone number and message');
      return;
    }

    setSending(true);
    try {
      let mediaUrls: string[] = [];

      // Upload image if present
      if (imageFile) {
        setUploading(true);
        const uploader = new ImageUploader('media-mms');
        const result = await uploader.uploadProcessedImage(
          imageFile, 
          imageFile.name, 
          '-mms-test'
        );
        mediaUrls = [result.publicUrl!];
        setUploading(false);
      }

      // Send SMS using TwilioClient
      await twilioClient.sendSMS({
        to: phone,
        body: message,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined
      });

      toast.success(imageFile ? 'Test MMS sent successfully!' : 'Test SMS sent successfully!');
      setPhone('');
      setMessage('');
      setImageFile(null);
      setImagePreview(null);
      onSent();
    } catch (error) {
      console.error('Error sending SMS:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const characterCount = message.length;
  const maxLength = 160;

  return (
    <Card id="quick-send">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Zap className="h-5 w-5 text-yellow-600" />
          <span>Quick Send</span>
        </CardTitle>
        <CardDescription>Send a test SMS message instantly</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Include country code (e.g., +1 for US)
            </p>
          </div>

          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Enter your test message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 min-h-[80px]"
              maxLength={maxLength}
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-muted-foreground">
                Test messages are not counted against your quota
              </p>
              <span className={`text-xs ${
                characterCount > maxLength * 0.9 ? 'text-orange-600' : 'text-muted-foreground'
              }`}>
                {characterCount}/{maxLength}
              </span>
            </div>
          </div>

          {/* Image Upload for MMS */}
          <div>
            <div className="flex items-center justify-between">
              <Label>Image (Optional)</Label>
              {imageStatus !== 'idle' && (
                <div className="flex items-center space-x-1 text-xs">
                  {imageStatus === 'processing' && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-muted-foreground">Processing...</span>
                    </>
                  )}
                  {imageStatus === 'success' && (
                    <>
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span className="text-green-600">Ready</span>
                    </>
                  )}
                  {imageStatus === 'error' && (
                    <>
                      <X className="h-3 w-3 text-red-600" />
                      <span className="text-red-600">Error</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="mt-1">
              {imagePreview ? (
                <div className="relative">
                  <img 
                    src={imagePreview} 
                    alt="MMS Preview" 
                    className={`w-full h-32 object-cover rounded-lg border transition-opacity ${
                      processingImage ? 'opacity-50' : 'opacity-100'
                    }`}
                  />
                  {processingImage && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2"
                    disabled={processingImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  {imageFile && (
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {Math.round(imageFile.size / 1024)}KB
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                  {processingImage ? (
                    <div className="space-y-2">
                      <Loader2 className="h-8 w-8 mx-auto text-muted-foreground animate-spin" />
                      <p className="text-sm text-muted-foreground">
                        Processing image...
                      </p>
                    </div>
                  ) : (
                    <>
                      <Image className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Add image for MMS (max 500KB)
                      </p>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                          input?.click();
                        }}
                      >
                        Select Image
                      </Button>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG, and GIF only. Large images are automatically optimized for MMS.
            </p>
          </div>

          <Button 
            type="submit" 
            disabled={sending || uploading || processingImage || !phone || !message}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {processingImage ? 'Processing Image...' : uploading ? 'Uploading Image...' : sending ? 'Sending...' : imageFile ? 'Send Test MMS' : 'Send Test SMS'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};