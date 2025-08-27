
import React from 'react';

interface LayoutPreviewProps {
  type: 'header-hero' | 'header-simple' | 'image-full' | 'image-left' | 'image-right' | 'button-centered' | 'button-left' | 'button-right' | 'text-double' | 'text-triple' | 'text-plain' | 'newsletter-header' | 'quote-featured' | 'cta-primary' | 'image-60-40' | 'image-70-30' | 'image-overlay' | 'image-background';
}

export const LayoutPreview: React.FC<LayoutPreviewProps> = ({ type }) => {
  const getPreview = () => {
    switch (type) {
      case 'header-hero':
        return (
          <div className="h-full bg-gradient-to-br from-slate-300 to-slate-400 rounded-md flex flex-col items-center justify-center text-slate-700 relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10 rounded-md"></div>
            <div className="relative text-center">
              <div className="text-sm font-bold mb-1">Hero Title</div>
              <div className="text-xs opacity-80">Compelling subtitle text</div>
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
          <div className="h-full bg-gradient-to-br from-slate-200 to-slate-300 rounded-md flex items-center justify-center relative">
            <div className="absolute inset-2 bg-white/30 rounded border-2 border-slate-300/60 border-dashed"></div>
            <div className="text-xs font-medium text-slate-600">Full Width Image</div>
          </div>
        );
      
      case 'image-left':
        return (
          <div className="h-full flex gap-1 rounded-md overflow-hidden">
            <div className="w-1/2 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
              <div className="text-xs font-medium text-slate-600">Image</div>
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
            <div className="w-1/2 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
              <div className="text-xs font-medium text-slate-600">Image</div>
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

      case 'text-plain':
        return (
          <div className="h-full bg-white border rounded-md flex flex-col justify-center px-3">
            <div className="w-full h-1 bg-gray-300 rounded mb-2"></div>
            <div className="w-5/6 h-1 bg-gray-200 rounded mb-1"></div>
            <div className="w-4/5 h-1 bg-gray-200 rounded mb-1"></div>
            <div className="w-3/4 h-1 bg-gray-200 rounded"></div>
          </div>
        );

      case 'newsletter-header':
        return (
          <div className="h-full bg-gradient-to-r from-slate-400 to-slate-500 rounded-md flex flex-col items-center justify-center text-white relative">
            <div className="text-xs font-bold mb-1">Newsletter</div>
            <div className="text-xs opacity-90 mb-1">Issue #001</div>
            <div className="text-xs opacity-75">Jan 2024</div>
          </div>
        );

      case 'quote-featured':
        return (
          <div className="h-full bg-gradient-to-br from-slate-50 to-slate-100 rounded-md flex flex-col items-center justify-center border-l-4 border-slate-400">
            <div className="text-xs font-medium text-slate-700 mb-1">"Quote text"</div>
            <div className="text-xs text-slate-600">— Author</div>
          </div>
        );

      case 'cta-primary':
        return (
          <div className="h-full bg-gradient-to-b from-slate-50 to-slate-100 rounded-md flex flex-col items-center justify-center gap-1 border">
            <div className="text-xs font-bold text-slate-700">Enhanced CTA</div>
            <div className="w-3/4 h-1 bg-slate-200 rounded"></div>
            <div className="bg-slate-600 text-white px-3 py-1 rounded text-xs font-medium">
              Take Action
            </div>
          </div>
        );

      case 'image-60-40':
        return (
          <div className="h-full flex gap-1 rounded-md overflow-hidden">
            <div className="w-3/5 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
              <div className="text-xs font-medium text-slate-600">60%</div>
            </div>
            <div className="w-2/5 bg-white border flex flex-col justify-center px-1">
              <div className="w-full h-1 bg-gray-300 rounded mb-1"></div>
              <div className="w-3/4 h-1 bg-gray-200 rounded"></div>
            </div>
          </div>
        );

      case 'image-70-30':
        return (
          <div className="h-full flex gap-1 rounded-md overflow-hidden">
            <div className="w-7/10 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
              <div className="text-xs font-medium text-slate-600">70%</div>
            </div>
            <div className="w-3/10 bg-white border flex flex-col justify-center px-1">
              <div className="w-full h-1 bg-gray-300 rounded mb-1"></div>
              <div className="w-full h-1 bg-gray-200 rounded"></div>
            </div>
          </div>
        );

      case 'image-overlay':
        return (
          <div className="h-full bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 rounded-md flex items-center justify-center relative">
            <div className="absolute inset-0 bg-black/30 rounded-md"></div>
            <div className="relative text-center text-white">
              <div className="text-xs font-bold">Overlay Text</div>
            </div>
          </div>
        );

      case 'image-background':
        return (
          <div className="h-full bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 rounded-md flex items-center justify-center relative">
            <div className="absolute inset-0 bg-white/40 rounded-md"></div>
            <div className="relative text-center">
              <div className="text-xs font-medium text-slate-600">Background</div>
            </div>
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
