import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Send, Zap, Image, X } from 'lucide-react';
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input to allow selecting the same file again
    e.target.value = '';

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    
    // Check if file type is supported
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, and GIF images are supported for MMS');
      return;
    }

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
          toast.error('Image is still too large after compression. Please use a smaller image.');
          return;
        }
        
        toast.success(`Image compressed from ${Math.round(file.size / 1024)}KB to ${Math.round(processedFile.size / 1024)}KB`);
      }

      setImageFile(processedFile);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(processedFile);
    } catch (error) {
      console.error('Image processing error:', error);
      toast.error('Failed to process image. Please try a different image.');
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
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
            <Label>Image (Optional)</Label>
            <div className="mt-1">
              {imagePreview ? (
                <div className="relative">
                  <img 
                    src={imagePreview} 
                    alt="MMS Preview" 
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                  <Image className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Add image for MMS (max 500KB)
                  </p>
                  <label>
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span>Select Image</span>
                    </Button>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG, and GIF only. Large images are automatically compressed to fit MMS limits.
            </p>
          </div>

          <Button 
            type="submit" 
            disabled={sending || uploading || !phone || !message}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : sending ? 'Sending...' : imageFile ? 'Send Test MMS' : 'Send Test SMS'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};