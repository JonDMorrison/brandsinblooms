
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Search, Shuffle, Image as ImageIcon, Loader2, ExternalLink, Camera, CheckCircle } from 'lucide-react';
import { useImageSuggestions } from '@/hooks/useImageSuggestions';
import { useUnsplash } from '@/hooks/useUnsplash';
import { useContentAssets } from '@/hooks/useContentAssets';
import { cn } from '@/lib/utils';

interface MediaSelectorProps {
  onImageSelect: (imageUrl: string, metadata?: any) => void;
  selectedImageUrl?: string;
  contentContext?: string;
  className?: string;
  compact?: boolean;
}

export const MediaSelector: React.FC<MediaSelectorProps> = ({
  onImageSelect,
  selectedImageUrl,
  contentContext,
  className,
  compact = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('search');
  
  const { searchImages, loading: unsplashLoading } = useUnsplash();
  const { assets, loading: assetsLoading, uploadAsset } = useContentAssets();
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    const results = await searchImages(searchQuery);
    setSearchResults(results);
  };

  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    onImageSelect(imageUrl, metadata);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const asset = await uploadAsset(file, []);
      if (asset?.url) {
        handleImageSelect(asset.url, {
          source: 'upload',
          alt_text: `Uploaded image: ${file.name}`,
          file_name: file.name
        });
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  if (compact) {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Featured Image Display - Show prominently at top */}
        {selectedImageUrl && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>Featured Image Selected:</span>
            </div>
            <div className="relative aspect-video rounded-lg border-2 border-green-200 overflow-hidden bg-green-50">
              <img 
                src={selectedImageUrl} 
                alt="Selected featured image"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Selected
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Compact search bar */}
        <div className="flex gap-2">
          <Input
            placeholder="Search images..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="text-sm"
          />
          <Button 
            onClick={handleSearch} 
            disabled={unsplashLoading}
            size="sm"
            variant="outline"
          >
            {unsplashLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          </Button>
        </div>

        {/* Compact upload button */}
        <div className="flex gap-2">
          <label className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button variant="outline" size="sm" className="w-full text-xs" asChild>
              <span>
                <Upload className="h-3 w-3 mr-1" />
                Upload New Image
              </span>
            </Button>
          </label>
        </div>

        {/* Compact image grid */}
        {searchResults.length > 0 && (
          <div>
            <div className="text-xs text-slate-600 mb-2 font-medium">Search Results:</div>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {searchResults.slice(0, 6).map((image, index) => (
                <div
                  key={index}
                  className={cn(
                    "relative group cursor-pointer aspect-square rounded overflow-hidden border-2 transition-all",
                    selectedImageUrl === image.url 
                      ? "border-green-500 bg-green-50" 
                      : "border-slate-200 hover:border-primary"
                  )}
                  onClick={() => handleImageSelect(image.url, {
                    source: 'unsplash',
                    alt_text: image.alt,
                    photographer: image.photographer,
                    unsplash_id: image.id,
                    thumb: image.thumb
                  })}
                >
                  <img 
                    src={image.thumb} 
                    alt={image.alt}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {selectedImageUrl === image.url ? (
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    ) : (
                      <Camera className="h-4 w-4 text-white" />
                    )}
                  </div>
                  {selectedImageUrl === image.url && (
                    <div className="absolute top-1 right-1">
                      <CheckCircle className="h-4 w-4 text-green-600 bg-white rounded-full" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Featured Image Display - Full mode */}
      {selectedImageUrl && (
        <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
          <div className="text-sm font-medium text-green-800 flex items-center gap-2 mb-3">
            <CheckCircle className="h-4 w-4" />
            <span>Currently Selected Image:</span>
          </div>
          <div className="relative aspect-video rounded-lg border border-green-300 overflow-hidden">
            <img 
              src={selectedImageUrl} 
              alt="Selected featured image"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search for images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={unsplashLoading}>
              {unsplashLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {searchResults.map((image, index) => (
                <Card 
                  key={index} 
                  className={cn(
                    "cursor-pointer transition-all",
                    selectedImageUrl === image.url 
                      ? "ring-2 ring-green-500 shadow-lg" 
                      : "hover:shadow-md"
                  )}
                >
                  <CardContent className="p-0">
                    <div 
                      className="relative aspect-square"
                      onClick={() => handleImageSelect(image.url, {
                        source: 'unsplash',
                        alt_text: image.alt,
                        photographer: image.photographer,
                        unsplash_id: image.id,
                        thumb: image.thumb
                      })}
                    >
                      <img 
                        src={image.thumb} 
                        alt={image.alt}
                        className="w-full h-full object-cover rounded-t-lg"
                      />
                      {selectedImageUrl === image.url && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle className="h-6 w-6 text-green-600 bg-white rounded-full" />
                        </div>
                      )}
                      {image.photographer && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2">
                          Photo by {image.photographer}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">Click to upload an image</p>
            </label>
          </div>
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          {assetsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : assets.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {assets.filter(asset => asset.type === 'image').map((asset) => (
                <Card 
                  key={asset.id} 
                  className={cn(
                    "cursor-pointer transition-all",
                    selectedImageUrl === asset.url 
                      ? "ring-2 ring-green-500 shadow-lg" 
                      : "hover:shadow-md"
                  )}
                >
                  <CardContent className="p-0">
                    <div 
                      className="relative aspect-square"
                      onClick={() => handleImageSelect(asset.url || '/placeholder.svg', {
                        source: 'upload',
                        alt_text: asset.name,
                        file_name: asset.name
                      })}
                    >
                      <img 
                        src={asset.url || '/placeholder.svg'} 
                        alt={asset.name}
                        className="w-full h-full object-cover rounded-t-lg"
                      />
                      {selectedImageUrl === asset.url && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle className="h-6 w-6 text-green-600 bg-white rounded-full" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ImageIcon className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2">No images in your library yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
