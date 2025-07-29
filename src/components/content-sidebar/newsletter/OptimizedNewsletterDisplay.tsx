
import React from 'react';
import { useNewsletterRenderer } from '@/hooks/useNewsletterRenderer';
import { convertNewsletterMarkdownToHtml } from '@/utils/newsletterContentProcessor';
import { ImageSelectButton } from '@/components/image/ImageSelectButton';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { Clock, Palette, Target } from 'lucide-react';

interface OptimizedNewsletterDisplayProps {
  content: string;
  className?: string;
  contentTaskId?: string;
  campaignTitle?: string;
  taskStatus?: string;
}

export const OptimizedNewsletterDisplay = ({ 
  content, 
  className = '',
  contentTaskId,
  campaignTitle,
  taskStatus
}: OptimizedNewsletterDisplayProps) => {
  console.log('[NEWSLETTER DISPLAY] Rendering with:', {
    contentLength: content?.length || 0,
    isPlaceholder: !content || content.length < 100,
    campaignTitle,
    taskStatus
  });

  // Use the newsletter renderer hook
  const {
    processedNewsletter,
    images,
    featuredImage,
    loadingImages,
    handleImageSelect,
    needsRegeneration,
    isStructured,
    featuredImagePrompt
  } = useNewsletterRenderer({
    content,
    campaignTitle,
    contentTaskId,
    format: 'magazine',
    className
  });

  // Handle empty or placeholder content
  if (needsRegeneration) {
    return (
      <div className={`newsletter-display space-y-6 ${className}`}>
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Newsletter content is being prepared...</p>
        </div>
      </div>
    );
  }

  const renderFeaturedImage = () => (
    <div className="mb-8">
      <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
        {featuredImage ? (
          <img 
            src={featuredImage.url} 
            alt={featuredImage.alt}
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageSelectButton
            onImageSelect={(imageUrl) => console.log('Featured image selected:', imageUrl)}
            contentContext={featuredImagePrompt}
            className="w-full h-full"
            buttonText="Add Featured Image"
            mode="inline"
          />
        )}
      </div>
      {featuredImage?.photographer && (
        <p className="text-xs text-gray-500 mt-2">
          Photo by {featuredImage.photographer}
        </p>
      )}
    </div>
  );

  const renderNewsletterHeader = () => (
    <div className="mb-8">
      <h1 className="text-4xl font-bold text-slate-900 mb-4">
        {campaignTitle || processedNewsletter.meta.week_focus}
      </h1>
      
      <div className="flex flex-wrap gap-3 mb-6">
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {processedNewsletter.meta.reading_time}
        </Badge>
        <Badge variant="outline" className="flex items-center gap-1">
          <Palette className="w-3 h-3" />
          {processedNewsletter.meta.theme}
        </Badge>
        <Badge variant="outline" className="flex items-center gap-1">
          <Target className="w-3 h-3" />
          {isStructured ? 'Structured' : 'Standard'} Format
        </Badge>
      </div>
    </div>
  );

  const renderStructuredNewsletter = () => (
    <div className="space-y-8">
      {processedNewsletter.blocks.map((block, index) => (
        <div key={index} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Block Image */}
          <div className="aspect-video bg-gray-100">
            {images[index] ? (
              <img 
                src={images[index].url} 
                alt={images[index].alt}
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageSelectButton
                onImageSelect={(imageUrl) => console.log(`Block ${index} image selected:`, imageUrl)}
                contentContext={block.image_prompt}
                className="w-full h-full"
                buttonText="Add Section Image"
                mode="inline"
              />
            )}
          </div>
          
          {/* Block Content */}
          <div className="p-6">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">
              {block.title}
            </h2>
            <div className="prose prose-slate max-w-none mb-4">
              <p className="text-slate-700 leading-relaxed">{block.body}</p>
            </div>
            {block.cta && (
              <div className="mt-4">
                <a 
                  href={block.link || '#'} 
                  className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  {block.cta}
                </a>
              </div>
            )}
          </div>
          
          {images[index]?.photographer && (
            <div className="px-6 pb-3">
              <p className="text-xs text-gray-500">
                Photo by {images[index].photographer}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderUnstructuredNewsletter = () => {
    const htmlContent = convertNewsletterMarkdownToHtml(processedNewsletter.newsletter_md);
    
    return (
      <div className="space-y-8">
        {/* Render sections with images */}
        {processedNewsletter.unstructuredSections?.map((section, index) => (
          <div key={section.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Section Image */}
            <div className="aspect-video bg-gray-100">
              {images[section.id] ? (
                <img 
                  src={images[section.id].url} 
                  alt={images[section.id].alt}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageSelectButton
                  onImageSelect={(imageUrl) => console.log(`Section ${section.id} image selected:`, imageUrl)}
                  contentContext={section.image_prompt}
                  className="w-full h-full"
                  buttonText="Add Section Image"
                  mode="inline"
                />
              )}
            </div>
            
            {/* Section Content */}
            <div className="p-6">
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                {section.title}
              </h2>
              <div className="prose prose-slate max-w-none">
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: convertNewsletterMarkdownToHtml(section.content) 
                  }} 
                />
              </div>
            </div>
            
            {images[section.id]?.photographer && (
              <div className="px-6 pb-3">
                <p className="text-xs text-gray-500">
                  Photo by {images[section.id].photographer}
                </p>
              </div>
            )}
          </div>
        )) || (
          // Fallback: render as single content block with main newsletter markdown
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div 
              className="prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`newsletter-display space-y-6 ${className}`}>
      {/* Featured Image */}
      {renderFeaturedImage()}
      
      {/* Newsletter Header */}
      {renderNewsletterHeader()}
      
      {/* Loading State */}
      {loadingImages && (
        <div className="text-center py-4">
          <LoadingSpinner />
          <p className="text-sm text-gray-600 mt-2">Loading newsletter images...</p>
        </div>
      )}
      
      {/* Newsletter Content */}
      {isStructured ? renderStructuredNewsletter() : renderUnstructuredNewsletter()}
      
      {/* Debug Info */}
      {import.meta.env.DEV && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg text-xs text-gray-600">
          <p><strong>Debug Info:</strong></p>
          <p>Format: {isStructured ? 'Structured' : 'Unstructured'}</p>
          <p>Blocks: {processedNewsletter.blocks.length}</p>
          <p>Sections: {processedNewsletter.unstructuredSections?.length || 0}</p>
          <p>Images Loaded: {Object.keys(images).length}</p>
          <p>Featured Image: {featuredImage ? 'Yes' : 'No'}</p>
        </div>
      )}
    </div>
  );
};
