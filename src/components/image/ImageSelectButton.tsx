// Enhanced ImageSelectButton with beautiful modal design
import React, { useState } from "react";
import { Button } from "@/components/ui-legacy/button";
import { Dialog, DialogContent } from "@/components/ui-legacy/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-legacy/tabs";
import { Input } from "@/components/ui-legacy/input";
import { Badge } from "@/components/ui-legacy/badge";
import {
  Camera,
  Search,
  Upload,
  X,
  ImageIcon,
  Sparkles,
  Wand2,
  Edit3,
  Download,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaSelector } from "./MediaSelector";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ImageSelectButtonProps {
  onImageSelect: (imageUrl: string, metadata?: any) => void;
  selectedImageUrl?: string;
  contentContext?: string;
  className?: string;
  buttonText?: string;
  mode?: "modal" | "inline";
  compact?: boolean;
}

export const ImageSelectButton: React.FC<ImageSelectButtonProps> = ({
  onImageSelect,
  selectedImageUrl,
  contentContext,
  className,
  buttonText = "Select an Image",
  mode = "modal",
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiGeneratedImages, setAiGeneratedImages] = useState<any[]>([]);
  const { toast } = useToast();

  /**
   * Generate 3 AI images based on content context
   * Stores all images in global_image_gallery with proper tagging
   */
  const handleAIGeneration = async () => {
    if (!contentContext?.trim()) {
      toast({
        title: "Content Required",
        description: "Content context is needed to generate relevant images",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingAI(true);
    setAiGeneratedImages([]);

    try {
      // Generate 3 images in parallel
      const promises = [1, 2, 3].map(async (index) => {
        try {
          const { data, error } = await supabase.functions.invoke(
            "generate-ai-image",
            {
              body: {
                contentContext: contentContext.trim(),
                contentTitle: "",
                channel: "instagram",
                uploadToStorage: true,
              },
            },
          );

          if (error) throw error;

          return {
            id: data.globalImageId || `ai-${index}-${Date.now()}`,
            url: data.imageUrl,
            thumb_url: data.imageUrl,
            download_url: data.imageUrl,
            alt: "AI generated image",
            photographer: "AI Generated",
            globalImageId: data.globalImageId,
            tags: data.metadata?.tags || [],
            source: "ai_generated",
          };
        } catch (err) {
          console.error(`[AI-Image] Failed to generate image ${index}:`, err);
          return null;
        }
      });

      const results = await Promise.all(promises);
      const successfulImages = results.filter(Boolean);

      if (successfulImages.length === 0) {
        throw new Error("Failed to generate any images");
      }

      setAiGeneratedImages(successfulImages);

      toast({
        title: "Images Generated",
        description: `Successfully generated ${successfulImages.length}/3 AI images`,
      });
    } catch (error: any) {
      console.error("[AI-Image] Generation failed:", error);
      toast({
        title: "Generation Failed",
        description:
          error.message || "Failed to generate AI images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    onImageSelect(imageUrl, metadata);
    if (mode === "modal") {
      setIsOpen(false);
    } else {
      setShowSelector(false);
    }
  };

  // Inline mode - render MediaSelector directly
  if (mode === "inline") {
    return (
      <div className={className}>
        {selectedImageUrl && (
          <div className="relative group mb-4">
            <img
              src={selectedImageUrl}
              alt="Selected"
              className="w-full h-32 object-cover rounded-lg border border-primary/20"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSelector(!showSelector)}
                className="bg-background/90 hover:bg-background"
              >
                <Edit3 className="h-3 w-3 mr-1" />
                Change Image
              </Button>
            </div>
          </div>
        )}

        {/* Show MediaSelector when no image is selected or when showSelector is true */}
        {(!selectedImageUrl || showSelector) && (
          <MediaSelector
            onImageSelect={handleImageSelect}
            selectedImageUrl={selectedImageUrl}
            contentContext={contentContext}
            className="w-full"
            compact={compact}
          />
        )}
      </div>
    );
  }

  // Modal mode - Beautiful redesigned modal
  return (
    <>
      <div className={className} onClick={(e) => e.stopPropagation()}>
        {selectedImageUrl ? (
          <div
            className="relative group cursor-pointer"
            onClick={() => setIsOpen(true)}
          >
            <img
              src={selectedImageUrl}
              alt="Selected"
              className="w-full h-32 object-cover rounded-xl border-2 border-gray-200 hover:border-primary/50 transition-colors"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/90 hover:bg-white text-gray-900"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Change Image
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(true)}
            className="w-full h-32 border-2 border-dashed border-gray-300 hover:border-primary/50 hover:bg-primary/5 transition-colors rounded-xl"
          >
            <div className="text-center">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <span className="text-sm text-gray-600">{buttonText}</span>
            </div>
          </Button>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-0 overflow-hidden bg-gradient-to-br from-gray-50 to-white">
          {/* Beautiful Header */}
          <div className="relative p-6 pb-0 border-b border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Select Image
                  </h2>
                  <p className="text-gray-500">
                    Choose the perfect image for your content
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="hover:bg-gray-100 rounded-full h-10 w-10"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            <Tabs defaultValue="browse" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-8 bg-white border shadow-sm rounded-xl h-12">
                <TabsTrigger
                  value="browse"
                  className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg"
                >
                  <Search className="w-4 h-4" />
                  Browse & Search
                </TabsTrigger>
                <TabsTrigger
                  value="upload"
                  className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg"
                >
                  <Upload className="w-4 h-4" />
                  Upload File
                </TabsTrigger>
                <TabsTrigger
                  value="suggestions"
                  className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg"
                >
                  <Sparkles className="w-4 h-4" />
                  AI Generation
                </TabsTrigger>
              </TabsList>

              {/* Browse Tab with enhanced MediaSelector */}
              <TabsContent value="browse" className="space-y-6 mt-0">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <MediaSelector
                    onImageSelect={handleImageSelect}
                    selectedImageUrl={selectedImageUrl}
                    contentContext={contentContext}
                    compact={false}
                  />
                </div>
              </TabsContent>

              {/* Upload Tab with beautiful design */}
              <TabsContent value="upload" className="space-y-6 mt-0">
                <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
                  <div className="border-2 border-dashed border-blue-300 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-12 text-center hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-100 hover:to-indigo-100 transition-all cursor-pointer group">
                    <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform">
                      <Upload className="h-10 w-10 text-blue-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-3">
                      Upload Your Image
                    </h3>
                    <p className="text-gray-600 mb-4 text-lg">
                      Drag and drop your file here, or click to browse
                    </p>
                    <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
                      <Badge variant="outline" className="bg-white">
                        JPG
                      </Badge>
                      <Badge variant="outline" className="bg-white">
                        PNG
                      </Badge>
                      <Badge variant="outline" className="bg-white">
                        GIF
                      </Badge>
                      <Badge variant="outline" className="bg-white">
                        Up to 10MB
                      </Badge>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* AI Generation Tab */}
              <TabsContent value="suggestions" className="space-y-6 mt-0">
                <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
                  {aiGeneratedImages.length === 0 ? (
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-6 mx-auto">
                        <Wand2 className="h-10 w-10 text-purple-600" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-800 mb-3">
                        AI Image Generation
                      </h3>
                      <p className="text-gray-600 mb-8 max-w-md mx-auto text-lg">
                        Generate 3 unique AI images based on your content. All
                        images are stored in the central gallery with searchable
                        tags.
                      </p>
                      <Button
                        size="lg"
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        onClick={handleAIGeneration}
                        disabled={isGeneratingAI || !contentContext?.trim()}
                      >
                        {isGeneratingAI ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            Generating Images...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 mr-2" />
                            Generate 3 AI Images
                          </>
                        )}
                      </Button>

                      {!contentContext?.trim() && (
                        <p className="text-sm text-gray-400 mt-4">
                          Content context needed for AI image generation
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                            <Heart className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-800">
                              AI Generated Images
                            </h3>
                            <p className="text-gray-500">
                              Stored in central gallery with tags
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleAIGeneration}
                          disabled={isGeneratingAI}
                          size="sm"
                        >
                          {isGeneratingAI ? "Generating..." : "Generate New"}
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {aiGeneratedImages.map((image, index) => (
                          <div
                            key={`ai-${image.id}-${index}`}
                            className="relative group cursor-pointer rounded-lg overflow-hidden border-2 border-gray-200 hover:border-purple-400 hover:shadow-lg transition-all"
                            onClick={() => handleImageSelect(image.url, image)}
                          >
                            <div className="aspect-square bg-gray-100">
                              <img
                                src={image.thumb_url || image.url}
                                alt={image.alt || "AI generated image"}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>

                            {/* AI Badge */}
                            <div className="absolute top-2 left-2">
                              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 text-xs">
                                <Sparkles className="w-3 h-3 mr-1" />
                                AI Generated
                              </Badge>
                            </div>

                            {/* Selection Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                            {/* Hover Info */}
                            <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="text-white text-xs">
                                <p className="font-medium">Click to select</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Feature highlights */}
                  {aiGeneratedImages.length === 0 && (
                    <div className="grid grid-cols-3 gap-6 mt-12 pt-8 border-t border-gray-100">
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3 mx-auto">
                          <Heart className="w-6 h-6 text-green-600" />
                        </div>
                        <h4 className="font-semibold text-gray-800">
                          Contextual
                        </h4>
                        <p className="text-sm text-gray-600">
                          Matches your content theme
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3 mx-auto">
                          <Download className="w-6 h-6 text-blue-600" />
                        </div>
                        <h4 className="font-semibold text-gray-800">
                          High Quality
                        </h4>
                        <p className="text-sm text-gray-600">
                          Professional AI-generated images
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-3 mx-auto">
                          <Sparkles className="w-6 h-6 text-orange-600" />
                        </div>
                        <h4 className="font-semibold text-gray-800">Instant</h4>
                        <p className="text-sm text-gray-600">
                          Results in seconds
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Save and Close Button */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-end">
              <Button
                onClick={() => setIsOpen(false)}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2"
              >
                Save and Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
