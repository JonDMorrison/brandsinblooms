import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Send, Zap, Image, X, CheckCircle, Loader2, Globe, Upload, Maximize2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { twilioClient } from '@/lib/sms/twilioClient';
import { ImageUploader } from '@/lib/image/imageUploader';
import { ImageProcessor, getOptimalFormat } from '@/lib/image/imageProcessor';
import { ImageSelectButton } from '@/components/image';
import { trackUnsplashDownload } from '@/lib/unsplashAttribution';

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
  // External image state
  const [externalImageUrl, setExternalImageUrl] = useState<string | null>(null);
  const [externalImageMetadata, setExternalImageMetadata] = useState<any>(null);
  // Drag and drop state
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Image preview controls
  const [objectFit, setObjectFit] = useState<'contain' | 'cover'>('contain');
  const [showFullScreen, setShowFullScreen] = useState(false);

  const processFile = async (file: File) => {
    // Clear external image if local file is selected
    setExternalImageUrl(null);
    setExternalImageMetadata(null);

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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input to allow selecting the same file again
    e.target.value = '';

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
    setImageStatus('idle');
    setProcessingImage(false);
    // Also clear external image
    setExternalImageUrl(null);
    setExternalImageMetadata(null);
  };

  const handleExternalImageSelect = async (imageUrl: string, metadata?: any) => {
    // Clear local image if external is selected
    setImageFile(null);
    setImagePreview(null);
    setImageStatus('idle');
    setProcessingImage(false);
    
    // Set external image
    setExternalImageUrl(imageUrl);
    setExternalImageMetadata(metadata);
    toast.success('Unsplash image selected for MMS');
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

      // Handle image - either local file or external URL
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
      } else if (externalImageUrl) {
        mediaUrls = [externalImageUrl];
        
        // Track Unsplash download if it's an Unsplash image
        if (externalImageMetadata?.id) {
          try {
            await trackUnsplashDownload(externalImageMetadata.id);
          } catch (error) {
            console.warn('Failed to track Unsplash download:', error);
          }
        }
      }

      // Send SMS using TwilioClient
      await twilioClient.sendSMS({
        to: phone,
        body: message,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined
      });

      const hasImage = imageFile || externalImageUrl;
      toast.success(hasImage ? 'Test MMS sent successfully!' : 'Test SMS sent successfully!');
      setPhone('');
      setMessage('');
      setImageFile(null);
      setImagePreview(null);
      setExternalImageUrl(null);
      setExternalImageMetadata(null);
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
            <div className="flex items-center justify-between mb-2">
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

            {(imagePreview || externalImageUrl) ? (
              <div className="space-y-3">
                {/* Image Controls - Stack on small screens */}
                <div className="flex flex-col space-y-2">
                  <div className="flex flex-wrap items-center gap-2 justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setObjectFit(objectFit === 'contain' ? 'cover' : 'contain')}
                      className="h-8 text-xs flex-shrink-0"
                      aria-pressed={objectFit === 'cover'}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      {objectFit === 'contain' ? 'Fill' : 'Fit'}
                    </Button>
                    <Dialog open={showFullScreen} onOpenChange={setShowFullScreen}>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs flex-shrink-0"
                        >
                          <Maximize2 className="h-3 w-3 mr-1" />
                          View Full
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] p-2">
                        <div className="flex items-center justify-center h-full">
                          <img 
                            src={imagePreview || externalImageUrl || ''} 
                            alt="MMS Preview - Full Size" 
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleRemoveImage}
                      className="h-8 flex-shrink-0"
                      disabled={processingImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Image Preview */}
                <div className="relative">
                  <img 
                    src={imagePreview || externalImageUrl || ''} 
                    alt="MMS Preview" 
                    className={`w-full h-40 sm:h-52 md:h-64 rounded-lg border bg-muted transition-opacity cursor-zoom-in ${
                      objectFit === 'contain' ? 'object-contain' : 'object-cover'
                    } ${processingImage ? 'opacity-50' : 'opacity-100'}`}
                    onClick={() => setShowFullScreen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setShowFullScreen(true);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label="Click to view full size image"
                  />
                  {processingImage && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                  {imageFile && (
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {Math.round(imageFile.size / 1024)}KB
                    </div>
                  )}
                  {externalImageUrl && (
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center space-x-1">
                      <Globe className="h-3 w-3" />
                      <span>Unsplash</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div 
                className={`
                  w-full max-w-full border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                  transition-colors duration-200 hover:bg-muted/50 flex flex-col items-center
                  ${isDragActive 
                    ? 'border-primary bg-primary/5' 
                    : processingImage 
                    ? 'border-muted-foreground/25 bg-muted/25' 
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                  }
                `}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={!processingImage ? handleBrowseClick : undefined}
                tabIndex={processingImage ? -1 : 0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!processingImage) handleBrowseClick();
                  }
                }}
                role="button"
                aria-label="Upload image or drag and drop"
              >
                {processingImage ? (
                  <div className="space-y-3">
                    <Loader2 className="h-10 w-10 mx-auto text-muted-foreground animate-spin" />
                    <p className="text-sm text-muted-foreground font-medium">
                      Processing image...
                    </p>
                  </div>
                ) : isDragActive ? (
                  <div className="space-y-3">
                    <Upload className="h-10 w-10 mx-auto text-primary" />
                    <div>
                      <p className="text-sm font-medium text-primary">
                        Drop to upload
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPG, PNG, GIF up to 500KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        Upload image for MMS
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Drag and drop or click to browse • JPG, PNG, GIF up to 500KB
                      </p>
                    </div>
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBrowseClick();
                        }}
                        className="w-full max-w-xs"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Image
                      </Button>
                      <span className="text-xs text-muted-foreground">or</span>
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                          }
                        }}
                        onTouchStart={(e) => e.stopPropagation()}
                      >
                        <ImageSelectButton
                          onImageSelect={handleExternalImageSelect}
                          contentContext={message || "MMS image"}
                          buttonText="Browse Free Images"
                          mode="modal"
                          compact
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif"
              onChange={handleImageSelect}
              className="hidden"
              aria-hidden="true"
            />
            
            <p className="text-xs text-muted-foreground mt-2">
              Upload your own image or browse free images from Unsplash. Large images are automatically optimized for MMS.
            </p>
          </div>

          <Button 
            type="submit" 
            disabled={sending || uploading || processingImage || !phone || !message}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {processingImage ? 'Processing Image...' : 
             uploading ? 'Uploading Image...' : 
             sending ? 'Sending...' : 
             (imageFile || externalImageUrl) ? 'Send Test MMS' : 'Send Test SMS'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};