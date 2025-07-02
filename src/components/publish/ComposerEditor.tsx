
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Bold, Italic, Link, Crop, Image, Settings, MousePointer, X, Upload, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Media image component with proper error handling
const MediaImage = ({ src, alt }: { src: string; alt: string }) => {
  const [imageError, setImageError] = useState(false);
  
  if (imageError) {
    return (
      <div className="w-full h-full flex items-center justify-center text-center p-6">
        <div>
          <div className="w-12 h-12 text-gray-400 mx-auto mb-3">📷</div>
          <p className="text-gray-600 font-medium mb-1">Media not available</p>
          <p className="text-gray-500 text-sm">Click to upload new media</p>
        </div>
      </div>
    );
  }
  
  return (
    <img 
      src={src} 
      alt={alt} 
      className="w-full h-full object-cover rounded-lg animate-scale-in"
      onError={() => setImageError(true)}
    />
  );
};

interface GeneratedContent {
  id: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  caption: string;
  mediaUrl?: string;
  platform?: string;
  campaignId?: string;
  createdAt: string;
}

interface ComposerEditorProps {
  selectedContent: GeneratedContent | null;
  onContentUpdate: (content: GeneratedContent) => void;
  onOpenDrawer: () => void;
}

export const ComposerEditor = ({ selectedContent, onContentUpdate, onOpenDrawer }: ComposerEditorProps) => {
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | undefined>('');
  const [isMediaExpanded, setIsMediaExpanded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedContent) {
      setCaption(selectedContent.caption);
      setMediaUrl(selectedContent.mediaUrl);
      setIsMediaExpanded(!!selectedContent.mediaUrl);
    }
  }, [selectedContent]);

  const handleCaptionChange = (newCaption: string) => {
    setCaption(newCaption);
    if (selectedContent) {
      const updatedContent = { ...selectedContent, caption: newCaption };
      onContentUpdate(updatedContent);
    }
  };

  // File validation
  const validateFile = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (!allowedTypes.includes(file.type)) {
      return 'Please upload a valid image file (JPEG, PNG, WebP, or GIF)';
    }
    
    if (file.size > maxSize) {
      return 'File size must be less than 10MB';
    }
    
    return null;
  };

  // Upload file to Supabase storage
  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedContent?.id}-${Date.now()}.${fileExt}`;
      const filePath = `content-uploads/${fileName}`;

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('content-assets')
        .upload(filePath, file);

      // Simulate upload progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 100);

      if (error) {
        clearInterval(progressInterval);
        console.error('Upload error:', error);
        toast.error('Failed to upload file: ' + error.message);
        return null;
      }

      setUploadProgress(100);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('content-assets')
        .getPublicUrl(data.path);

      if (!urlData.publicUrl) {
        toast.error('Failed to get file URL');
        return null;
      }

      // Update database with the uploaded image URL
      if (selectedContent) {
        await supabase
          .from('content_tasks')
          .update({ image_idea: urlData.publicUrl })
          .eq('id', selectedContent.id);
      }

      toast.success('File uploaded successfully!');
      return urlData.publicUrl;
    } catch (error) {
      console.error('Upload exception:', error);
      toast.error('Upload failed');
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const uploadedUrl = await uploadFile(file);
    if (uploadedUrl) {
      setMediaUrl(uploadedUrl);
      setIsMediaExpanded(true);
      
      if (selectedContent) {
        const updatedContent = { ...selectedContent, mediaUrl: uploadedUrl };
        onContentUpdate(updatedContent);
      }
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleAddMedia = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleRemoveMedia = () => {
    setMediaUrl('');
    setIsMediaExpanded(false);
    if (selectedContent) {
      const updatedContent = { ...selectedContent, mediaUrl: '' };
      onContentUpdate(updatedContent);
    }
  };

  const characterCount = caption.length;
  const maxCharacters = 2000; // Instagram limit
  const isNearLimit = characterCount >= 1950;
  const isOverLimit = characterCount > maxCharacters;
  const isAtWarning = characterCount >= 1950 && characterCount <= 2000;
  const excessChars = Math.max(0, characterCount - maxCharacters);

  const getCounterColor = () => {
    if (isOverLimit) return 'text-red-600';
    if (isAtWarning) return 'text-orange-500';
    return 'text-gray-600';
  };

  if (!selectedContent) {
    return (
      <Card className="h-full flex items-center justify-center bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="text-center p-8 max-w-md">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <MousePointer className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-[#3E5A6B] mb-3">Ready to publish?</h3>
          <p className="text-gray-600 mb-4">
            Select a post from the <strong>Social Content Queue</strong> on the left to start editing and publishing your content.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <p className="font-medium mb-2">What you can do here:</p>
            <ul className="text-left space-y-1">
              <li>• Edit captions and content</li>
              <li>• Add or change images</li>
              <li>• Schedule posts for later</li>
              <li>• Publish immediately to social media</li>
            </ul>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
      {/* Toolbar - Rebalanced */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-[#3E5A6B] h-7 w-7 p-0">
              <Bold className="w-[18px] h-[18px]" />
            </Button>
            <Button variant="ghost" size="sm" className="text-[#3E5A6B] h-7 w-7 p-0">
              <Italic className="w-[18px] h-[18px]" />
            </Button>
            <Button variant="ghost" size="sm" className="text-[#3E5A6B] h-7 w-7 p-0">
              <Link className="w-[18px] h-[18px]" />
            </Button>
            <Button variant="ghost" size="sm" className="text-[#3E5A6B] h-7 w-7 p-0">
              <Crop className="w-[18px] h-[18px]" />
            </Button>
          </div>
          
          <span 
            className={cn(
              "text-sm font-medium ml-2",
              getCounterColor()
            )}
          >
            {characterCount}/{maxCharacters}
          </span>
        </div>
        
        <div className="flex items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={onOpenDrawer}
                  disabled={isOverLimit}
                  className="bg-[#68BEB9] hover:bg-[#56a7a1] text-white text-sm h-8 disabled:opacity-50 disabled:cursor-not-allowed"
                  size="sm"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Publish Settings
                </Button>
              </TooltipTrigger>
              {isOverLimit && (
                <TooltipContent>
                  <p>Trim {excessChars} chars to continue</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Content Area - Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Media Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[#3E5A6B]">Media</label>
              <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {selectedContent.platform?.toUpperCase()} Post
              </div>
            </div>
            
            <div 
              className={cn(
                "w-full max-w-sm bg-gray-50 rounded-lg border-2 border-dashed flex items-center justify-center relative overflow-hidden transition-all duration-300 ease-in-out cursor-pointer",
                isMediaExpanded ? "aspect-square" : "h-60",
                isDragOver ? "border-[#68BEB9] bg-[#68BEB9]/10" : "border-gray-200",
                isUploading && "pointer-events-none"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={!isUploading ? handleAddMedia : undefined}
            >
              {isUploading ? (
                <div className="text-center p-6">
                  <Upload className="w-12 h-12 text-[#68BEB9] mx-auto mb-3 animate-bounce" />
                  <p className="text-[#68BEB9] font-medium mb-2">Uploading...</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-[#68BEB9] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">{uploadProgress}%</p>
                </div>
              ) : mediaUrl && isMediaExpanded ? (
                <div className="relative w-full h-full group">
                  <MediaImage 
                    src={mediaUrl} 
                    alt="Content media"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveMedia();
                    }}
                    className="absolute top-2 right-2 h-6 w-6 p-0 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="text-center p-6">
                  <div className={cn(
                    "transition-colors duration-200",
                    isDragOver ? "text-[#68BEB9]" : "text-gray-400"
                  )}>
                    <Image className="w-12 h-12 mx-auto mb-3" />
                  </div>
                  <p className={cn(
                    "font-medium mb-1 transition-colors duration-200",
                    isDragOver ? "text-[#68BEB9]" : "text-gray-600"
                  )}>
                    {isDragOver ? "Drop image here" : "Drop media here"}
                  </p>
                  <p className="text-gray-500 text-sm mb-3">
                    or click to browse files
                  </p>
                  <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                  <p className="text-xs text-gray-400 mt-2">
                    JPEG, PNG, WebP, GIF up to 10MB
                  </p>
                </div>
              )}
              
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>
          </div>

          {/* Caption Section */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-[#3E5A6B]">Caption</label>
            <Textarea
              value={caption}
              onChange={(e) => handleCaptionChange(e.target.value)}
              placeholder="Write your caption here..."
              className={cn(
                "min-h-[160px] resize-none border-gray-300 focus:border-[#68BEB9] focus:ring-[#68BEB9]/20",
                "text-base leading-relaxed",
                isOverLimit && "border-red-300 focus:border-red-500 focus:ring-red-500/20"
              )}
              style={{ caretColor: '#68BEB9' }}
            />
            
            {/* Helper text and error states */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                Instagram max = 2,000 chars • Twitter max = 280 (if toggled)
              </p>
              
              {isOverLimit && (
                <p className="text-red-600 text-sm font-medium">
                  Caption exceeds the {maxCharacters} character limit
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
