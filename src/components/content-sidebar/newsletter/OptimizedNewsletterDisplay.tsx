import React, { useState, useEffect } from 'react';
import { parseNewsletterYAML } from '@/utils/newsletterUtils';
import { processNewsletterContent, convertNewsletterMarkdownToHtml } from '@/utils/newsletterContentProcessor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Mail, FileText } from 'lucide-react';
import { useCRMAccess } from '@/hooks/useCRMAccess';
import { CRMUpgradePrompt } from '@/components/crm/CRMUpgradePrompt';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { NewsletterRegenerator } from './NewsletterRegenerator';
import { NewsletterContentBlock } from './NewsletterContentBlock';
import { useNewsletterImages } from './useNewsletterImages';
import { supabase } from '@/integrations/supabase/client';
import {
  calculateReadingTime,
  extractTitleFromContent,
  generateIntroFromContent,
  checkIsPlaceholderContent
} from './NewsletterHelpers';
import { sendToCRM } from '@/utils/sendToCRM';

interface OptimizedNewsletterDisplayProps {
  content: string;
  className?: string;
  contentTaskId?: string;
  campaignTitle?: string;
  taskStatus?: string;
}

export const OptimizedNewsletterDisplay = ({ 
  content, 
  className,
  contentTaskId,
  campaignTitle,
  taskStatus 
}: OptimizedNewsletterDisplayProps) => {
  const { hasCRMAccess } = useCRMAccess();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isPlaceholderContent = checkIsPlaceholderContent(content);
  const [selectedImages, setSelectedImages] = useState<Record<number, string>>({});
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  console.log('[NEWSLETTER] OptimizedNewsletterDisplay processing:', {
    hasContent: !!content,
    contentLength: content?.length || 0,
    isPlaceholder: isPlaceholderContent,
    contentTaskId,
    campaignTitle
  });

  // Process the newsletter content using the enhanced processor
  const processedNewsletter = processNewsletterContent(content || '', campaignTitle);
  
  // Only force regeneration for truly placeholder content or failed processing
  const needsRegeneration = processedNewsletter.needsRegeneration;
  
  // Use the specialized newsletter images hook for structured newsletters only
  console.log('[NEWSLETTER] Calling useNewsletterImages with:', {
    blocksCount: processedNewsletter.blocks.length,
    isPlaceholder: needsRegeneration,
    isStructured: processedNewsletter.isStructured,
    contentTaskId,
    sampleBlock: processedNewsletter.blocks[0]
  });
  
  const { images, loadingImages, imageErrors } = useNewsletterImages(
    processedNewsletter.blocks,
    needsRegeneration,
    contentTaskId,
    campaignTitle
  );

  // Extract main headline from processed content
  const headline = extractTitleFromContent(content, campaignTitle) || campaignTitle || 'Newsletter Update';
  
  // Extract intro from content
  const intro = generateIntroFromContent(content, campaignTitle);

  // Load existing selected images from attachments
  useEffect(() => {
    const loadSelectedImages = async () => {
      if (!contentTaskId) return;
      
      try {
        const { data, error } = await supabase
          .from('content_tasks')
          .select('attachments')
          .eq('id', contentTaskId)
          .single();
          
        if (error) {
          console.error('Error loading selected images:', error);
          return;
        }
        
        if (data?.attachments && typeof data.attachments === 'object' && data.attachments !== null) {
          const attachments = data.attachments as any;
          if (attachments.selectedImages) {
            setSelectedImages(attachments.selectedImages);
          }
        }
      } catch (error) {
        console.error('Error loading selected images:', error);
      }
    };
    
    loadSelectedImages();
  }, [contentTaskId]);

  // Handle image selection for blocks
  const handleImageSelect = async (blockIndex: number, imageUrl: string, metadata?: any) => {
    const newSelectedImages = {
      ...selectedImages,
      [blockIndex]: imageUrl
    };
    
    setSelectedImages(newSelectedImages);
    
    // Save to database if contentTaskId is available
    if (contentTaskId) {
      try {
        const { error } = await supabase
          .from('content_tasks')
          .update({
            attachments: {
              selectedImages: newSelectedImages,
              imageMetadata: {
                ...metadata,
                blockIndex,
                timestamp: new Date().toISOString()
              }
            }
          })
          .eq('id', contentTaskId);
          
        if (error) {
          console.error('Error saving selected image:', error);
          toast({
            title: "Error",
            description: "Failed to save image selection",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Success",
            description: "Image updated successfully"
          });
        }
      } catch (error) {
        console.error('Error saving selected image:', error);
        toast({
          title: "Error", 
          description: "Failed to save image selection",
          variant: "destructive"
        });
      }
    }
  };

  // Enhanced CRM integration with new sendToCRM function
  const handleUseinCRM = async () => {
    if (!contentTaskId) {
      toast({
        title: "Error",
        description: "Content ID not available for CRM transfer",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('🔄 Starting CRM transfer for content task:', contentTaskId);
      
      const success = await sendToCRM(contentTaskId);
      
      if (success) {
        console.log('✅ Content successfully sent to CRM - redirecting...');
        // Additional success feedback is handled in sendToCRM function
      } else {
        console.error('❌ CRM transfer failed');
        toast({
          title: "Transfer Failed",
          description: "Could not transfer newsletter to CRM. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Error in CRM transfer:', error);
      toast({
        title: "Transfer Error",
        description: "An unexpected error occurred during CRM transfer.",
        variant: "destructive"
      });
    }
  };

  // Check if content is approved
  const isApproved = taskStatus === 'approved' || taskStatus === 'scheduled' || taskStatus === 'published';

  // If content needs regeneration, show regeneration interface
  if (needsRegeneration) {
    console.log('[NEWSLETTER] Showing regeneration component for content that needs regeneration');
    return (
      <div className={`max-w-4xl mx-auto ${className || ''}`}>
        <div className="space-y-6 p-6 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">
                {isRegenerating ? 'Processing Newsletter...' : 'Newsletter Needs Processing'}
              </span>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-slate-900">
                {campaignTitle ? `${campaignTitle} Newsletter` : 'Newsletter Content'}
              </h3>
              <p className="text-slate-600 max-w-md mx-auto">
                {isRegenerating 
                  ? 'Processing newsletter content for proper display...'
                  : 'This newsletter content needs to be processed for optimal formatting and display.'
                }
              </p>
            </div>
            
            <div className="pt-4">
              <NewsletterRegenerator 
                contentTaskId={contentTaskId}
                campaignTitle={campaignTitle}
                regenerating={isRegenerating}
                setRegenerating={setIsRegenerating}
              />
            </div>
            
            {/* Show current content preview if available */}
            {content && !isRegenerating && (
              <div className="mt-6 p-4 bg-slate-50 rounded-lg border">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Current Content Preview:</h4>
                <div className="text-xs text-slate-600 max-h-32 overflow-y-auto">
                  {content.substring(0, 500)}...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-4xl mx-auto ${className || ''}`}>
      {/* Header Section */}
      <div className="mb-8 pb-6 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {processedNewsletter.meta.reading_time}
          </Badge>
          {processedNewsletter.meta.theme && (
            <Badge variant="secondary">
              {processedNewsletter.meta.theme}
            </Badge>
          )}
          <Badge variant="outline">
            Newsletter
          </Badge>
          {processedNewsletter.isStructured && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Structured
            </Badge>
          )}
        </div>
        
        <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-4">
          {headline}
        </h1>
        
        {intro && (
          <p className="text-xl text-slate-600 leading-relaxed font-light">
            {intro}
          </p>
        )}
      </div>

      {/* Main Content */}
      {processedNewsletter.isStructured && processedNewsletter.blocks.length > 0 ? (
        /* Structured Newsletter - Use block-based display */
        <div className="space-y-12">
          {processedNewsletter.blocks.map((block, index) => (
            <NewsletterContentBlock
              key={index}
              block={block}
              index={index}
              isStructuredNewsletter={true}
              images={images}
              imageErrors={imageErrors}
              loadingImages={loadingImages}
              onImageSelect={handleImageSelect}
              selectedImages={selectedImages}
            />
          ))}
        </div>
      ) : processedNewsletter.newsletter_md ? (
        /* Enhanced Markdown Content */
        <div className="prose prose-lg max-w-none mb-12 newsletter-enhanced-content">
          <div 
            className="newsletter-content"
            dangerouslySetInnerHTML={{ 
              __html: convertNewsletterMarkdownToHtml(processedNewsletter.newsletter_md) 
            }} 
          />
        </div>
      ) : (
        /* Plain Text Fallback */
        <div className="prose prose-lg max-w-none mb-12">
          <div 
            className="newsletter-content"
            dangerouslySetInnerHTML={{ 
              __html: convertNewsletterMarkdownToHtml(content) 
            }} 
          />
        </div>
      )}

      {/* Enhanced Footer */}
      <div className="mt-16 pt-8 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <p className="text-gray-600">
            Thanks for reading! 🌿
          </p>
          
          {/* Enhanced Use in CRM Button */}
          {isApproved && contentTaskId && (
            <div className="flex items-center gap-3">
              {hasCRMAccess ? (
                <Button 
                  onClick={handleUseinCRM}
                  variant="outline"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send to CRM
                </Button>
              ) : (
                <CRMUpgradePrompt variant="button" size="sm" />
              )}
            </div>
          )}
        </div>

        {/* Additional context for CRM integration */}
        {isApproved && contentTaskId && hasCRMAccess && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              💡 <strong>Tip:</strong> Clicking "Send to CRM" will convert this newsletter into an editable email campaign 
              with smart segment suggestions and all images preserved.
            </p>
          </div>
        )}
      </div>

      {/* Enhanced Newsletter Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .newsletter-enhanced-content .newsletter-content h2 {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border-radius: 8px;
            padding: 12px 16px;
            margin: 2rem 0 1rem 0;
            border-left: 4px solid #68BEB9;
          }
          
          .newsletter-enhanced-content .newsletter-content h3 {
            background: #f1f5f9;
            border-radius: 6px;
            padding: 8px 12px;
            margin: 1.5rem 0 0.75rem 0;
            border-left: 3px solid #94a3b8;
          }
          
          .newsletter-enhanced-content .newsletter-content p {
            line-height: 1.7;
            margin-bottom: 1rem;
          }
          
          .newsletter-enhanced-content .newsletter-content ul {
            background: #fefefe;
            border-radius: 8px;
            padding: 1rem 1.5rem;
            border-left: 3px solid #22c55e;
          }
        `
      }} />
    </div>
  );
};
