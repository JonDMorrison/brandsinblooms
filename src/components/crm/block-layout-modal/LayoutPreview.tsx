
import React from 'react';

interface LayoutPreviewProps {
  type: 'header-hero' | 'header-simple' | 'image-full' | 'image-left' | 'image-right' | 'button-centered' | 'button-left' | 'button-right' | 'text-double' | 'text-triple';
}

export const LayoutPreview: React.FC<LayoutPreviewProps> = ({ type }) => {
  const getPreview = () => {
    switch (type) {
      case 'header-hero':
        return (
          <div className="h-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-md flex flex-col items-center justify-center text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-black/20 rounded-md"></div>
            <div className="relative text-center">
              <div className="text-sm font-bold mb-1">Hero Title</div>
              <div className="text-xs opacity-90">Compelling subtitle text</div>
            </div>
          </div>
        );
      
      case 'header-simple':
        return (
          <div className="h-full bg-gradient-to-r from-gray-50 to-gray-100 rounded-md flex flex-col items-center justify-center border">
            <div className="text-sm font-bold text-gray-800 mb-1">Clean Header</div>
            <div className="text-xs text-gray-600">Simple subtitle</div>
            <div className="w-8 h-0.5 bg-primary mt-2 rounded"></div>
          </div>
        );
      
      case 'image-full':
        return (
          <div className="h-full bg-gradient-to-br from-green-200 to-green-300 rounded-md flex items-center justify-center relative">
            <div className="absolute inset-2 bg-white/20 rounded border-2 border-white/40 border-dashed"></div>
            <div className="text-xs font-medium text-green-800">Full Width Image</div>
          </div>
        );
      
      case 'image-left':
        return (
          <div className="h-full flex gap-1 rounded-md overflow-hidden">
            <div className="w-1/2 bg-gradient-to-br from-blue-200 to-blue-300 flex items-center justify-center">
              <div className="text-xs font-medium text-blue-800">Image</div>
            </div>
            <div className="w-1/2 bg-white border flex flex-col justify-center px-2">
              <div className="w-full h-1 bg-gray-300 rounded mb-1"></div>
              <div className="w-3/4 h-1 bg-gray-200 rounded mb-1"></div>
              <div className="w-1/2 h-1 bg-gray-200 rounded"></div>
            </div>
          </div>
        );
      
      case 'image-right':
        return (
          <div className="h-full flex gap-1 rounded-md overflow-hidden">
            <div className="w-1/2 bg-white border flex flex-col justify-center px-2">
              <div className="w-full h-1 bg-gray-300 rounded mb-1"></div>
              <div className="w-3/4 h-1 bg-gray-200 rounded mb-1"></div>
              <div className="w-1/2 h-1 bg-gray-200 rounded"></div>
            </div>
            <div className="w-1/2 bg-gradient-to-br from-purple-200 to-purple-300 flex items-center justify-center">
              <div className="text-xs font-medium text-purple-800">Image</div>
            </div>
          </div>
        );
      
      case 'button-centered':
        return (
          <div className="h-full bg-gradient-to-b from-gray-50 to-white rounded-md flex flex-col items-center justify-center gap-2 border">
            <div className="w-3/4 h-1 bg-gray-200 rounded"></div>
            <div className="w-1/2 h-1 bg-gray-200 rounded"></div>
            <div className="bg-primary text-white px-3 py-1 rounded text-xs font-medium mt-1">
              Call to Action
            </div>
          </div>
        );
      
      case 'button-left':
        return (
          <div className="h-full bg-gradient-to-b from-gray-50 to-white rounded-md flex flex-col justify-center pl-3 gap-2 border">
            <div className="w-3/4 h-1 bg-gray-200 rounded"></div>
            <div className="w-1/2 h-1 bg-gray-200 rounded"></div>
            <div className="bg-primary text-white px-3 py-1 rounded text-xs font-medium w-fit mt-1">
              Action
            </div>
          </div>
        );
      
      case 'button-right':
        return (
          <div className="h-full bg-gradient-to-b from-gray-50 to-white rounded-md flex flex-col justify-center items-end pr-3 gap-2 border">
            <div className="w-3/4 h-1 bg-gray-200 rounded"></div>
            <div className="w-1/2 h-1 bg-gray-200 rounded"></div>
            <div className="bg-primary text-white px-3 py-1 rounded text-xs font-medium mt-1">
              Action
            </div>
          </div>
        );
      
      case 'text-double':
        return (
          <div className="h-full flex gap-1 rounded-md overflow-hidden">
            <div className="w-1/2 bg-white border flex flex-col justify-center px-2">
              <div className="w-full h-1 bg-gray-300 rounded mb-1"></div>
              <div className="w-3/4 h-1 bg-gray-200 rounded mb-1"></div>
              <div className="w-1/2 h-1 bg-gray-200 rounded"></div>
            </div>
            <div className="w-1/2 bg-white border flex flex-col justify-center px-2">
              <div className="w-full h-1 bg-gray-300 rounded mb-1"></div>
              <div className="w-3/4 h-1 bg-gray-200 rounded mb-1"></div>
              <div className="w-1/2 h-1 bg-gray-200 rounded"></div>
            </div>
          </div>
        );
      
      case 'text-triple':
        return (
          <div className="h-full flex gap-1 rounded-md overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-1/3 bg-white border flex flex-col justify-center px-1">
                <div className="w-full h-1 bg-gray-300 rounded mb-1"></div>
                <div className="w-3/4 h-1 bg-gray-200 rounded mb-1"></div>
                <div className="w-1/2 h-1 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        );
      
      default:
        return (
          <div className="h-full bg-gray-100 rounded-md flex items-center justify-center">
            <div className="text-xs text-gray-500">Preview</div>
          </div>
        );
    }
  };

  return getPreview();
};
