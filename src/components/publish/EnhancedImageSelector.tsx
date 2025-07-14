import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Loader2, Image as ImageIcon, Palette, Check, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
// Removed sonner import - using global toast replacement
import { CanvaEditor } from '@/components/canva/CanvaEditor';
import { extractKeywords } from '@/utils/imageKeywords';
import { getEnhancedTopicForPostType } from '@/utils/dynamicImageSearch';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface UnsplashImage {
  id: string;
  thumb_url: string;
  download_url: string;
  full_url?: string;
  alt: string;
  photographer: string;
  photographer_url?: string;
  unsplash_id: string;
}

interface UniversalImageSelectorProps {
  // Core functionality
  onImageChange: (imageUrl: string) => void;
  
  // Context-specific (optional)
  task?: any;
  selectedImage?: UnsplashImage | string | null;
  
  // UI configuration
  showTabs?: boolean;
  defaultTab?: 'find' | 'upload';
  
  // Search context for smart suggestions
  contentContext?: string;
  campaignTitle?: string;
}

// Legacy interface for backward compatibility
interface EnhancedImageSelectorProps {
  task: any;
  onImageSelected: (image: UnsplashImage) => void;
  selectedImage?: UnsplashImage | null;
}

// Universal ImageSelector component
export const UniversalImageSelector = ({ 
  onImageChange, 
  task, 
  selectedImage, 
  showTabs = true, 
  defaultTab = 'find',
  contentContext,
  campaignTitle 
}: UniversalImageSelectorProps) => {
  const { user } = useAuth();
  
  // Find tab state
  const [images, setImages] = useState<UnsplashImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  
  // Upload tab state
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Canva editor state
  const [showCanvaEditor, setShowCanvaEditor] = useState(false);
  const [canvaImageUrl, setCanvaImageUrl] = useState('');
  const [addingToPost, setAddingToPost] = useState(false);
  
  // Tab management
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Auto-generate search query from task content
  const generateSmartQuery = (): string => {
    if (contentContext) return contentContext;
    if (campaignTitle) return campaignTitle;
    if (task?.ai_output) {
      const enhancedQuery = getEnhancedTopicForPostType(task, task?.campaigns);
      return enhancedQuery || 'garden center plants';
    }
    return 'garden center plants';
  };

  // Fetch images from Unsplash
  const fetchImages = async (query?: string) => {
    setLoading(true);
    const searchTerm = query || generateSmartQuery();
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { 
          query: searchTerm,
          maxImages: 4,
          orientation: 'squarish',
          orderBy: 'relevant',
          contentFilter: 'high'
        }
      });

      if (error) {
        console.error('Unsplash API error:', error);
        toast.error("Couldn't fetch images—try again.");
        return;
      }

      if (data?.images && data.images.length > 0) {
        setImages(data.images);
        // Auto-select first image if none selected
        if (!selectedImage && data.images.length > 0) {
          setSelectedImageIndex(0);
          onImageChange(data.images[0].download_url);
        }
      } else {
        setImages([]);
        toast.info('No images found for this search.');
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      toast.error("Couldn't fetch images—try again.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch images when component mounts
  useEffect(() => {
    if (task?.ai_output || contentContext || campaignTitle) {
      fetchImages();
    }
  }, [task?.ai_output, contentContext, campaignTitle]);

  // Handle custom search
  const handleSearch = () => {
    if (searchQuery.trim()) {
      fetchImages(searchQuery);
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
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

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
      onImageChange(uploadedUrl);
      toast.success('Image uploaded and selected!');
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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Handle image selection from Unsplash
  const handleImageSelect = (image: UnsplashImage, index: number) => {
    setSelectedImageIndex(index);
    onImageChange(image.download_url);
  };

  // Handle Canva editing
  const handleCanvaEdit = (image: UnsplashImage) => {
    setCanvaImageUrl(image.full_url || image.download_url);
    setShowCanvaEditor(true);
  };

  // Handle "Use This Image" action
  const handleUseImage = async (image: UnsplashImage) => {
    setAddingToPost(true);
    try {
      if (task) {
        // Legacy task-based workflow with database updates
        const currentAttachment = task.attachments?.[0];
        const isDifferentImage = !currentAttachment || 
          currentAttachment.url !== image.download_url ||
          currentAttachment.unsplash_id !== image.id;

        // If it's a different image and task is currently approved, set to review
        const shouldRequireReApproval = isDifferentImage && task.status === 'approved';
        
        const updateData: any = {
          attachments: [
            {
              type: 'image',
              url: image.download_url,
              thumbnail: image.thumb_url,
              alt: image.alt,
              photographer: image.photographer,
              source: 'unsplash',
              unsplash_id: image.id
            }
          ]
        };

        // If changing image on approved content, require re-approval
        if (shouldRequireReApproval) {
          updateData.status = 'review';
        }

        const { error } = await supabase
          .from('content_tasks')
          .update(updateData)
          .eq('id', task.id);

        if (error) {
          throw error;
        }

        if (shouldRequireReApproval) {
          toast.success('Image updated! Content moved to review for re-approval.');
        } else {
          toast.success('Image added to post successfully!');
        }
        
        // Trigger refresh
        window.dispatchEvent(new CustomEvent('draft-updated'));
      } else {
        // Universal callback for non-task workflows
        onImageChange(image.download_url);
        toast.success('Image selected successfully!');
      }
    } catch (error) {
      console.error('Error handling image selection:', error);
      toast.error('Failed to process image selection');
    } finally {
      setAddingToPost(false);
    }
  };

  const handleCanvaComplete = (newImageUrl: string) => {
    // Update with the new Canva-edited version
    onImageChange(newImageUrl);
    toast.success('Design saved successfully!');
    setShowCanvaEditor(false);
  };

  const renderFindTab = () => (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex gap-2">
        <Input
          placeholder="Search for specific images..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Image Grid */}
      {!loading && images.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {images.map((image, index) => (
              <div
                key={image.id}
                className={cn(
                  "relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer group transition-all duration-200 hover:scale-105",
                  selectedImageIndex === index ? 'ring-2 ring-primary ring-offset-2' : ''
                )}
                onClick={() => handleImageSelect(image, index)}
              >
                <img
                  src={image.thumb_url}
                  alt={image.alt}
                  className="w-full h-full object-cover"
                />
                {selectedImageIndex === index && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <div className="bg-primary text-primary-foreground rounded-full p-2">
                      <Check className="w-4 h-4" />
                    </div>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="text-white text-xs truncate">
                    by {image.photographer}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Selected Image Preview & Actions - only show in task mode */}
          {task && selectedImageIndex !== null && images[selectedImageIndex] && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <img
                    src={images[selectedImageIndex].thumb_url}
                    alt={images[selectedImageIndex].alt}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <h4 className="font-medium">Selected Image</h4>
                  <p className="text-sm text-gray-600">
                    Photo by {images[selectedImageIndex].photographer} on Unsplash
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => handleUseImage(images[selectedImageIndex])}
                      disabled={addingToPost}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {addingToPost ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Adding...
                        </>
                      ) : (
                        'Use This Image'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleCanvaEdit(images[selectedImageIndex])}
                    >
                      <Palette className="w-4 h-4 mr-2" />
                      Edit in Canva
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search for More */}
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => fetchImages(searchQuery || generateSmartQuery())}
              disabled={loading}
            >
              <Search className="w-4 h-4 mr-2" />
              Search for More Images
            </Button>
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && images.length === 0 && (
        <div className="text-center py-8">
          <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No images found. Try a different search term.</p>
          <Button onClick={() => fetchImages()} variant="outline">
            <Search className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      )}
    </div>
  );

  const renderUploadTab = () => (
    <div className="space-y-6">
      <div 
        className={cn(
          "w-full h-60 bg-gray-50 rounded-lg border-2 border-dashed flex items-center justify-center relative overflow-hidden transition-all duration-300 ease-in-out cursor-pointer",
          isDragOver ? "border-primary bg-primary/10" : "border-gray-200",
          isUploading && "pointer-events-none"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!isUploading ? () => fileInputRef.current?.click() : undefined}
      >
        {isUploading ? (
          <div className="text-center p-6">
            <Upload className="w-12 h-12 text-primary mx-auto mb-3 animate-bounce" />
            <p className="text-primary font-medium mb-2">Uploading...</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600">{uploadProgress}%</p>
          </div>
        ) : (
          <div className="text-center p-6">
            <div className={cn(
              "transition-colors duration-200",
              isDragOver ? "text-primary" : "text-gray-400"
            )}>
              <Upload className="w-12 h-12 mx-auto mb-3" />
            </div>
            <p className={cn(
              "font-medium mb-1 transition-colors duration-200",
              isDragOver ? "text-primary" : "text-gray-600"
            )}>
              {isDragOver ? "Drop image here" : "Drop your image here"}
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
  );

  return (
    <>
      <Card className="w-full">
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Select Image</h3>
            </div>
          </div>

          {/* Tabbed Interface */}
          {showTabs ? (
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'find' | 'upload')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="find">Find a Free Image</TabsTrigger>
                <TabsTrigger value="upload">Upload Your Own</TabsTrigger>
              </TabsList>
              <TabsContent value="find" className="mt-6">
                {renderFindTab()}
              </TabsContent>
              <TabsContent value="upload" className="mt-6">
                {renderUploadTab()}
              </TabsContent>
            </Tabs>
          ) : (
            // Legacy single-tab mode for backward compatibility
            renderFindTab()
          )}
        </CardContent>
      </Card>

      {/* Canva Editor Modal */}
      {showCanvaEditor && (
        <CanvaEditor
          isOpen={showCanvaEditor}
          onClose={() => setShowCanvaEditor(false)}
          imageUrl={canvaImageUrl}
          contentTaskId={task?.id || ''}
          onDesignComplete={handleCanvaComplete}
        />
      )}
    </>
  );
};

// Legacy wrapper for backward compatibility
export const EnhancedImageSelector = ({ task, onImageSelected, selectedImage }: EnhancedImageSelectorProps) => {
  const handleImageChange = (imageUrl: string) => {
    // Convert URL back to UnsplashImage format for legacy compatibility
    const legacyImage: UnsplashImage = {
      id: Date.now().toString(),
      thumb_url: imageUrl,
      download_url: imageUrl,
      full_url: imageUrl,
      alt: 'Selected image',
      photographer: 'Unknown',
      photographer_url: '',
      unsplash_id: ''
    };
    onImageSelected(legacyImage);
  };

  return (
    <UniversalImageSelector
      onImageChange={handleImageChange}
      task={task}
      selectedImage={selectedImage}
      showTabs={true}
      defaultTab="find"
    />
  );
};