import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Crop, RotateCw, Filter, Scissors, Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';
// Removed sonner import - using global toast replacement

interface ImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onSave: (editedImageUrl: string) => void;
}

export const ImageEditor = ({ isOpen, onClose, imageUrl, onSave }: ImageEditorProps) => {
  const [activeFilter, setActiveFilter] = useState<string>('none');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const filters = [
    { name: 'none', label: 'Original', filter: '' },
    { name: 'sepia', label: 'Sepia', filter: 'sepia(100%)' },
    { name: 'grayscale', label: 'B&W', filter: 'grayscale(100%)' },
    { name: 'vintage', label: 'Vintage', filter: 'sepia(50%) contrast(120%) brightness(110%)' },
    { name: 'vibrant', label: 'Vibrant', filter: 'saturate(150%) contrast(110%)' },
    { name: 'cool', label: 'Cool', filter: 'hue-rotate(180deg) saturate(120%)' }
  ];

  const getFilterStyle = () => {
    const selectedFilter = filters.find(f => f.name === activeFilter);
    const customFilters = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    const transform = `rotate(${rotation}deg)`;
    
    return {
      filter: selectedFilter?.filter ? `${selectedFilter.filter} ${customFilters}` : customFilters,
      transform
    };
  };

  const handleReset = () => {
    setActiveFilter('none');
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleRemoveBackground = async () => {
    if (!imageRef.current) return;
    
    try {
      setIsProcessing(true);
      toast.info('Removing background...');
      
      // Dynamic import of the background removal function
      const { removeBackground, loadImage } = await import('@/lib/backgroundRemoval');
      
      // Convert image to blob first
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      // Load as HTMLImageElement
      const imageElement = await loadImage(blob);
      
      // Remove background
      const processedBlob = await removeBackground(imageElement);
      
      // Create URL for the processed image
      const processedUrl = URL.createObjectURL(processedBlob);
      
      onSave(processedUrl);
      toast.success('Background removed successfully!');
      onClose();
    } catch (error) {
      console.error('Background removal error:', error);
      toast.error('Failed to remove background. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!canvasRef.current || !imageRef.current) return;
    
    try {
      setIsProcessing(true);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = imageRef.current;
      
      if (!ctx) return;
      
      // Set canvas size to match image
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      
      // Apply transformations
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      
      // Apply filters
      const filterStyle = getFilterStyle();
      ctx.filter = filterStyle.filter;
      
      // Draw the image
      ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
      ctx.restore();
      
      // Convert to blob and create URL
      canvas.toBlob((blob) => {
        if (blob) {
          const editedUrl = URL.createObjectURL(blob);
          onSave(editedUrl);
          toast.success('Image edited successfully!');
          onClose();
        }
      }, 'image/png', 0.9);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save edited image');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Edit Image</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
          {/* Controls Panel */}
          <div className="space-y-4 overflow-y-auto">
            <Card className="p-4">
              <h3 className="font-medium mb-3">Filters</h3>
              <div className="grid grid-cols-2 gap-2">
                {filters.map((filter) => (
                  <Button
                    key={filter.name}
                    variant={activeFilter === filter.name ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveFilter(filter.name)}
                    className="text-xs"
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </Card>
            
            <Card className="p-4">
              <h3 className="font-medium mb-3">Adjustments</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600">Brightness</label>
                  <Slider
                    value={[brightness]}
                    onValueChange={(value) => setBrightness(value[0])}
                    min={50}
                    max={150}
                    step={1}
                    className="mt-1"
                  />
                  <span className="text-xs text-gray-500">{brightness}%</span>
                </div>
                
                <div>
                  <label className="text-xs text-gray-600">Contrast</label>
                  <Slider
                    value={[contrast]}
                    onValueChange={(value) => setContrast(value[0])}
                    min={50}
                    max={150}
                    step={1}
                    className="mt-1"
                  />
                  <span className="text-xs text-gray-500">{contrast}%</span>
                </div>
                
                <div>
                  <label className="text-xs text-gray-600">Saturation</label>
                  <Slider
                    value={[saturation]}
                    onValueChange={(value) => setSaturation(value[0])}
                    min={0}
                    max={200}
                    step={1}
                    className="mt-1"
                  />
                  <span className="text-xs text-gray-500">{saturation}%</span>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <h3 className="font-medium mb-3">Tools</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRotate}
                  className="w-full justify-start"
                >
                  <RotateCw className="w-4 h-4 mr-2" />
                  Rotate 90°
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveBackground}
                  disabled={isProcessing}
                  className="w-full justify-start"
                >
                  <Scissors className="w-4 h-4 mr-2" />
                  Remove Background
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="w-full justify-start"
                >
                  Reset All
                </Button>
              </div>
            </Card>
          </div>
          
          {/* Preview Area */}
          <div className="col-span-2 flex flex-col">
            <div className="flex-1 bg-checkered rounded-lg overflow-hidden flex items-center justify-center">
              <div className="max-w-full max-h-full">
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Edit preview"
                  style={getFilterStyle()}
                  className="max-w-full max-h-full object-contain transition-all duration-200"
                  crossOrigin="anonymous"
                />
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-4">
              <Button variant="outline" onClick={handleReset}>
                Reset
              </Button>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={isProcessing}
                  className="bg-[#68BEB9] hover:bg-[#56a7a1] text-white"
                >
                  {isProcessing ? 'Processing...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
};