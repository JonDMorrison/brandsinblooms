// Enhanced ImageSelectButton with beautiful modal design
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Heart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaSelector } from './MediaSelector';

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
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSelector, setShowSelector] = useState(false);

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
      <div 
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        {selectedImageUrl ? (
          <div className="relative group cursor-pointer" onClick={() => setIsOpen(true)}>
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
                  <h2 className="text-2xl font-bold text-gray-900">Select Image</h2>
                  <p className="text-gray-500">Choose the perfect image for your content</p>
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
                <TabsTrigger value="browse" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg">
                  <Search className="w-4 h-4" />
                  Browse & Search
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg">
                  <Upload className="w-4 h-4" />
                  Upload File
                </TabsTrigger>
                <TabsTrigger value="suggestions" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg">
                  <Sparkles className="w-4 h-4" />
                  AI Suggestions
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
                    <h3 className="text-2xl font-bold text-gray-800 mb-3">Upload Your Image</h3>
                    <p className="text-gray-600 mb-4 text-lg">Drag and drop your file here, or click to browse</p>
                    <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
                      <Badge variant="outline" className="bg-white">JPG</Badge>
                      <Badge variant="outline" className="bg-white">PNG</Badge>
                      <Badge variant="outline" className="bg-white">GIF</Badge>
                      <Badge variant="outline" className="bg-white">Up to 10MB</Badge>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* AI Suggestions Tab */}
              <TabsContent value="suggestions" className="space-y-6 mt-0">
                <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-6 mx-auto">
                    <Wand2 className="h-10 w-10 text-purple-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">AI-Powered Suggestions</h3>
                  <p className="text-gray-600 mb-8 max-w-md mx-auto text-lg">
                    Let our AI analyze your content and suggest the most relevant, high-quality images
                  </p>
                  <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Smart Suggestions
                  </Button>
                  
                  {/* Feature highlights */}
                  <div className="grid grid-cols-3 gap-6 mt-12 pt-8 border-t border-gray-100">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3 mx-auto">
                        <Heart className="w-6 h-6 text-green-600" />
                      </div>
                      <h4 className="font-semibold text-gray-800">Contextual</h4>
                      <p className="text-sm text-gray-600">Matches your content theme</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3 mx-auto">
                        <Download className="w-6 h-6 text-blue-600" />
                      </div>
                      <h4 className="font-semibold text-gray-800">High Quality</h4>
                      <p className="text-sm text-gray-600">Professional images only</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-3 mx-auto">
                        <Sparkles className="w-6 h-6 text-orange-600" />
                      </div>
                      <h4 className="font-semibold text-gray-800">Instant</h4>
                      <p className="text-sm text-gray-600">Results in seconds</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};