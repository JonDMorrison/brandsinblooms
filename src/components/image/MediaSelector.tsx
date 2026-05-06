import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui-legacy/button";
import { Card, CardContent } from "@/components/ui-legacy/card";
import { Input } from "@/components/ui-legacy/input";
import {
  Upload,
  Search,
  Image as ImageIcon,
  Loader2,
  Edit3,
  Camera,
  ArrowLeft,
} from "lucide-react";
import { useContentAssets } from "@/hooks/useContentAssets";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { extractImageSummary } from "@/utils/imageContentSummary";
import { validateImageQuery } from "@/utils/dynamicImageSearch";
import {
  getRelevantFallbacks,
  formatFallbackImages,
} from "@/services/gardenCenterFallbacks";

interface MediaSelectorProps {
  onImageSelect: (imageUrl: string, metadata?: any) => void;
  selectedImageUrl?: string;
  contentContext?: string;
  className?: string;
  compact?: boolean;
  onBackClick?: () => void;
  autoSelectFirst?: boolean;
}

export const MediaSelector: React.FC<MediaSelectorProps> = ({
  onImageSelect,
  selectedImageUrl,
  contentContext,
  className,
  compact = false,
  onBackClick,
  autoSelectFirst = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showingSuggestions, setShowingSuggestions] = useState(false);
  const [selectedImageMetadata, setSelectedImageMetadata] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const { uploadAsset } = useContentAssets();

  // Helper to normalize fallback images to expected shape
  const normalizeFallbacks = (formatted: any[]) =>
    formatted.map((img) => ({
      id: img.id,
      url: img.download_url,
      thumb_url: img.thumb_url,
      alt: img.alt,
      photographer: img.photographer,
      photographer_url: undefined,
      download_location: undefined,
      source: "fallback",
    }));

  // Ensure at least 4 results for proper grid display
  const supplementWithFallbacks = (results: any[], query: string) => {
    if (results.length >= 4) return results.slice(0, 6);

    const deficit = 4 - results.length;

    const fallbacks = getRelevantFallbacks(query, deficit);
    const formatted = formatFallbackImages(fallbacks, query);
    const normalized = normalizeFallbacks(formatted);

    // Combine and deduplicate by id
    const combined = [...results];
    normalized.forEach((fallback) => {
      if (!combined.find((img) => img.id === fallback.id)) {
        combined.push(fallback);
      }
    });

    return combined.slice(0, 6);
  };

  // Load default suggestions on mount and auto-select first image
  useEffect(() => {
    const loadDefaultSuggestions = async () => {
      if (searchResults.length === 0 && !showingSuggestions) {
        setShowingSuggestions(true);
        setSearchLoading(true);
        const rawQuery = contentContext
          ? extractImageSummary(contentContext)
          : "garden center";
        const defaultQuery = validateImageQuery(rawQuery);

        try {
          const finalResults = supplementWithFallbacks([], defaultQuery);
          setSearchResults(finalResults);

          // Auto-select first image only when caller explicitly opts in
          // (autoSelectFirst). The previous "auto-select to avoid showing
          // placeholder" branch silently applied an unrelated stock image
          // the moment the picker opened — and because the parent
          // ImageSelectButton dismisses the modal on selection in modal
          // mode, users never got to pick. Bail to placeholder instead.
          if (autoSelectFirst && !selectedImageUrl && finalResults.length > 0) {
            const firstImage = finalResults[0];
            const imageMetadata = {
              source: firstImage.source || "curated",
              alt_text: firstImage.alt,
              photographer: firstImage.photographer,
              photographer_url: firstImage.photographer_url,
              thumb: firstImage.thumb_url || firstImage.thumb,
              download_location: firstImage.download_location,
            };
            handleImageSelect(
              firstImage.url || firstImage.download_url,
              imageMetadata,
            );
          }
        } catch (error) {
          console.error("[MediaSelector] Error loading suggestions:", error);
        } finally {
          setSearchLoading(false);
        }
      }
    };

    loadDefaultSuggestions();
  }, [
    contentContext,
    searchResults.length,
    showingSuggestions,
    selectedImageUrl,
    onImageSelect,
  ]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    const cleanQuery = validateImageQuery(searchQuery);

    setShowingSuggestions(false);
    setSearchLoading(true);
    try {
      const finalResults = supplementWithFallbacks([], cleanQuery);
      setSearchResults(finalResults);
    } catch (error) {
      console.error("[MediaSelector] Search error:", error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    setSelectedImageMetadata(metadata);

    if (onImageSelect) {
      onImageSelect(imageUrl, metadata);
    } else {
      console.error("[MediaSelector] onImageSelect prop is missing!");
    }
  };

  const handleThumbnailClick = (image: any, index: number) => {
    const imageMetadata = {
      source: image.source || "curated",
      alt_text: image.alt,
      photographer: image.photographer,
      photographer_url: image.photographer_url,
      thumb: image.thumb,
      download_location: image.download_location,
    };

    // Directly call handleImageSelect instead of going to preview mode
    handleImageSelect(image.url, imageMetadata);
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const asset = await uploadAsset(file, []);
      if (asset?.url) {
        handleImageSelect(asset.url, {
          source: "upload",
          alt_text: `Uploaded image: ${file.name}`,
          file_name: file.name,
        });
      }
    } catch (error) {
      console.error("[MediaSelector] Upload failed:", error);
      toast.error("Upload failed");
    }
  };

  // Removed handleConfirmSelection and handleBackToBrowse - no longer needed

  if (compact) {
    return (
      <div className={cn("w-full space-y-6", className)}>
        {/* Featured Image */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Featured Image</h4>
          {selectedImageUrl ? (
            <div className="relative group aspect-video rounded-lg border-2 border-green-200 overflow-hidden bg-green-50">
              <img
                src={selectedImageUrl}
                alt={selectedImageMetadata?.alt_text || "Featured image"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error(
                    "[MediaSelector] Compact image failed to load:",
                    selectedImageUrl,
                  );
                  const currentSrc = e.currentTarget.src;
                  const fallbackPath = "/images/newsletter-fallback.jpg";

                  if (!currentSrc.includes("newsletter-fallback.jpg")) {
                    e.currentTarget.src = fallbackPath;
                  } else {
                    e.currentTarget.src =
                      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1Zjd1YSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzM4NSI+SW1hZ2UgVW5hdmFpbGFibGU8L3RleHQ+PC9zdmc+";
                  }
                }}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                <Button size="sm">
                  <Edit3 className="h-3 w-3 mr-1" />
                  Change Image
                </Button>
              </div>
            </div>
          ) : (
            <div className="aspect-video rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Select a featured image</p>
              </div>
            </div>
          )}
        </div>

        {/* Search Controls */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Search Images</h4>
          <div className="flex gap-2">
            <Input
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              className="text-sm"
            />
            <Button
              onClick={handleSearch}
              disabled={searchLoading}
              size="sm"
              variant="outline"
            >
              {searchLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Search className="h-3 w-3" />
              )}
            </Button>
          </div>

          <label className="block">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              asChild
            >
              <span>
                <Upload className="h-3 w-3 mr-1" />
                Upload New Image
              </span>
            </Button>
          </label>
        </div>

        {/* Image Thumbnails - FIXED CLICKABLE AREA */}
        {searchResults.length > 0 && (
          <div className="space-y-3 relative z-20">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">
                {showingSuggestions ? "Suggested Images" : "Search Results"}
              </h4>
              <span className="text-xs text-gray-500">
                {searchResults.length} images found
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 min-h-[200px]">
              {searchResults.slice(0, 3).map((image, index) => {
                return (
                  <button
                    key={image.id || index}
                    className="relative group cursor-pointer aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-green-500 transition-all duration-200 bg-white shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleThumbnailClick(image, index);
                    }}
                    type="button"
                    tabIndex={0}
                  >
                    <img
                      src={
                        image.thumb_url ||
                        image.thumb ||
                        image.download_url ||
                        image.url
                      }
                      alt={image.alt || "Image thumbnail"}
                      className="w-full h-full object-cover pointer-events-none"
                      onError={(e) => {
                        console.error(
                          "[MediaSelector] Compact thumbnail failed to load:",
                          {
                            src: e.currentTarget.src,
                            image: image,
                          },
                        );
                        // Fallback chain
                        const currentSrc = e.currentTarget.src;
                        if (currentSrc !== (image.download_url || image.url)) {
                          e.currentTarget.src = image.download_url || image.url;
                        } else {
                          // Show placeholder
                          e.currentTarget.src =
                            "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y1ZjdmYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzY2NzM4NSI+SW1hZ2U8L3RleHQ+PC9zdmc+";
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                      <div className="bg-white rounded-full p-2">
                        <Camera className="h-4 w-4 text-gray-700" />
                      </div>
                    </div>
                    {image.photographer && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                        <p className="text-white text-xs truncate">
                          Photo by {image.photographer}
                        </p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 text-center">
              Showing 3 of {searchResults.length} options.
            </p>
          </div>
        )}

        {/* Loading State */}
        {searchLoading && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">
              Loading Images...
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-lg bg-gray-100 animate-pulse flex items-center justify-center"
                >
                  <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {!searchLoading &&
          searchResults.length === 0 &&
          !showingSuggestions && (
            <div className="text-center py-8">
              <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                No images found. Try a different search term.
              </p>
            </div>
          )}
      </div>
    );
  }

  // Two-column layout: Featured image on left, thumbnails on right
  return (
    <div className={cn("w-full", className)}>
      {onBackClick && (
        <Button
          variant="ghost"
          onClick={onBackClick}
          className="mb-4 p-0 h-auto font-normal text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to selection
        </Button>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Left Column: Featured Image (50%) */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-gray-800">
            Featured Image
          </h4>
          {selectedImageUrl ? (
            <div className="relative group aspect-video rounded-lg border-2 border-primary/20 overflow-hidden bg-primary/5">
              <img
                src={selectedImageUrl}
                alt={selectedImageMetadata?.alt_text || "Featured image"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error(
                    "[MediaSelector] Featured image failed to load:",
                    selectedImageUrl,
                  );
                  const currentSrc = e.currentTarget.src;
                  const fallbackPath = "/images/newsletter-fallback.jpg";

                  if (!currentSrc.includes("newsletter-fallback.jpg")) {
                    e.currentTarget.src = fallbackPath;
                  } else {
                    e.currentTarget.src =
                      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1Zjd1YSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzM4NSI+SW1hZ2UgVW5hdmFpbGFibGU8L3RleHQ+PC9zdmc+";
                  }
                }}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2"></div>
              {selectedImageMetadata?.photographer && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <p className="text-white text-sm">
                    Photo by {selectedImageMetadata.photographer}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-video rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Featured image will appear here</p>
                <p className="text-sm text-gray-500 mt-1">
                  Select from thumbnails on the right
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Thumbnails (50%) */}
        <div className="space-y-4 w-full">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-gray-800">
              Select Image
            </h4>
            {searchResults.length > 0 && (
              <span className="text-sm text-gray-500">
                {searchResults.length} available
              </span>
            )}
          </div>

          {/* Search and Upload Controls - Two Columns */}
          <div className="grid grid-cols-2 gap-3 w-full">
            {/* Left: Search Controls */}
            <div className="flex gap-2">
              <Input
                placeholder="Search images..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button
                onClick={handleSearch}
                disabled={searchLoading}
                variant="outline"
                size="sm"
              >
                {searchLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Right: Upload Button */}
            <div className="w-full">
              <label className="block w-full">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button variant="outline" className="w-full" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Custom Image
                  </span>
                </Button>
              </label>
            </div>
          </div>

          {/* Thumbnail Grid */}
          {searchResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">
                {showingSuggestions ? "Suggested Images" : "Search Results"}
              </p>
              <div className="grid grid-cols-3 gap-3">
                {searchResults.slice(0, 3).map((image, index) => {
                  const isSelected =
                    selectedImageUrl === (image.url || image.download_url);
                  return (
                    <button
                      key={image.id || index}
                      className={cn(
                        "relative group cursor-pointer aspect-video rounded-lg overflow-hidden border-2 transition-all duration-200 bg-white shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary",
                        isSelected
                          ? "border-primary shadow-lg"
                          : "border-gray-200 hover:border-primary/50",
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleThumbnailClick(image, index);
                      }}
                      type="button"
                      tabIndex={0}
                    >
                      <img
                        src={
                          image.thumb_url ||
                          image.thumb ||
                          image.download_url ||
                          image.url
                        }
                        alt={image.alt || "Image thumbnail"}
                        className="w-full h-full object-cover pointer-events-none"
                        onError={(e) => {
                          console.error(
                            "[MediaSelector] Thumbnail failed to load:",
                            {
                              src: e.currentTarget.src,
                              image: image,
                            },
                          );
                          const currentSrc = e.currentTarget.src;
                          if (
                            currentSrc !== (image.download_url || image.url)
                          ) {
                            e.currentTarget.src =
                              image.download_url || image.url;
                          } else {
                            e.currentTarget.src =
                              "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1ZjdmYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzM4NSI+SW1hZ2U8L3RleHQ+PC9zdmc+";
                          }
                        }}
                      />

                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="bg-primary text-primary-foreground rounded-full p-2">
                            <Camera className="h-5 w-5" />
                          </div>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                        <div className="bg-white rounded-full p-3">
                          <Camera className="h-5 w-5 text-gray-700" />
                        </div>
                      </div>

                      {image.photographer && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                          <p className="text-white text-sm truncate">
                            Photo by {image.photographer}
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Loading State */}
          {searchLoading && searchResults.length === 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="aspect-video rounded-lg bg-gray-200 animate-pulse"
                  />
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {!searchLoading &&
            searchResults.length === 0 &&
            !showingSuggestions && (
              <div className="text-center py-8">
                <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No images found</p>
                <p className="text-sm text-gray-500 mt-1">
                  Try a different search term
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
