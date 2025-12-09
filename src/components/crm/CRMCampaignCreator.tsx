
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSegmentCounts } from '@/hooks/useSegmentCounts';
import { Loader2, Mail, ArrowLeft, Users, Sparkles, Send, Eye } from 'lucide-react';
import { useSenderConfiguration } from '@/hooks/useSenderConfiguration';
import { SharedSenderConfirmationModal } from './campaigns/SharedSenderConfirmationModal';
import { CleanEmailBlockEditor } from './CleanEmailBlockEditor';
import { EmailPreview } from './campaign-composer/EmailPreview';
import { ContentBlock } from '@/types/emailBuilder';
import { convertNewsletterToCRM } from '@/utils/newsletterToCrmSync';
import { supabase } from '@/integrations/supabase/client';
import { saveCampaignAsDraft, sendCampaign, CampaignData } from '@/utils/crmCampaignService';
import { imageGenerationService } from '@/services/imageGenerationService';
import { SaveIndicator } from '@/components/crm/SaveIndicator';
import { generateFooterHTML } from '@/utils/emailFooterRenderer';
import { getDefaultTokenData } from '@/utils/emailTokenProcessor';
import { useFooterSettings } from '@/hooks/useFooterSettings';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';
import { generateNewsletterBlocks, getFallbackBlocks } from '@/services/newsletterBlockGenerator';
import { fetchSmartImage } from '@/services/unsplashService';
import { useGeneratedBundle } from '@/hooks/useGeneratedBundle';
import { CampaignSetupWizard } from './campaign-setup/CampaignSetupWizard';
import { AIWriterDialog } from './ai-writer/AIWriterDialog';
import { AIPersonalizationDialog } from './AIPersonalizationDialog';
import { SenderStatusIndicator } from './campaigns/SenderStatusIndicator';
import { CampaignActionBar } from './CampaignActionBar';
import { CampaignReadiness } from './CampaignReadiness';
import { createBlockPrompt } from '@/utils/blockPromptBuilder';
import { normalizeAIResponse, applyAIToBlock } from '@/lib/newsletter/aiMapping';
import { usePagePersistence } from '@/hooks/usePagePersistence';
import { normalizeBlockForSave, normalizeBlockFromDatabase, DatabaseBlock } from '@/utils/blockFieldMapping';
import { useSaveQueue } from '@/hooks/useSaveQueue';
import { DraftRestorationDialog } from './DraftRestorationDialog';
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { generateCampaignSessionId } from '@/types/campaign';
import { sanitizeCampaignTitle } from '@/utils/weekNumberSanitizer';

// Helper function to generate images for blocks using batch API
interface ImageGenerationContext {
  title: string;
  description: string;
  seasonalFocus: string;
  weekNumber?: number;
}

async function generateImagesForBlocks(
  blocks: ContentBlock[],
  context: ImageGenerationContext,
  usedImageIds: Set<string>,
  setUsedImageIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  setBlocks: React.Dispatch<React.SetStateAction<ContentBlock[]>>
): Promise<void> {
  try {
    console.log('🖼️ Starting image generation with uniqueness tracking...');
    console.log(`🚫 Currently tracking ${usedImageIds.size} used images`);
    
    // Find all blocks that need images
    const blocksNeedingImages = blocks
      .map((block, index) => {
        console.log(`📋 Block ${index}: type="${block.type}", imageUrl="${block.imageUrl || 'undefined'}", hasBody=${!!block.body}, hasContent=${!!block.content}`);
        return { block, index };
      })
      .filter(({ block, index }) => {
        const shouldFetch = block.type === 'image' || block.type === 'image-text';
        const needsImage = shouldFetch && (!block.imageUrl || block.imageUrl === 'loading');
        if (shouldFetch) {
          console.log(`  ✓ Block ${index} is ${block.type}, needsImage=${needsImage} (imageUrl: "${block.imageUrl || 'undefined'}")`);
        }
        return needsImage;
      });
    
    console.log(`📸 Found ${blocksNeedingImages.length} blocks needing images out of ${blocks.length} total blocks`);
    
    if (blocksNeedingImages.length === 0) {
      console.log('📸 No blocks need images, skipping image generation');
      console.log('📸 Block types:', blocks.map((b, i) => `${i}: ${b.type} (img: "${b.imageUrl || 'none'}")`).join(', '));
      return;
    }
    
    console.log(`📸 Generating ${blocksNeedingImages.length} unique images...`);
    
    // Process each block sequentially to track uniqueness
    for (let iteration = 0; iteration < blocksNeedingImages.length; iteration++) {
      const { block, index: blockIndex } = blocksNeedingImages[iteration];
      try {
        console.log(`\n🎨 Processing block ${iteration + 1}/${blocksNeedingImages.length} (block index: ${blockIndex})`);
        
        // Build content context with strong fallbacks to ensure we never pass empty string
        const contentContext = (
          block.body || 
          block.content || 
          block.headline ||
          block.title ||
          context.description || 
          context.title ||
          'Beautiful garden center plants and flowers for seasonal display'
        ).trim();
        
        const contentTitle = (
          block.headline || 
          block.title || 
          context.title || 
          'Garden Newsletter'
        ).trim();
        
        // Final safety check - ensure we have valid content
        if (!contentContext || contentContext.length < 5) {
          console.warn(`⚠️ Block ${blockIndex} has insufficient content, using generic fallback`);
          const genericContext = `${context.seasonalFocus || 'seasonal'} garden plants and flowers`;
          console.log(`   Using fallback: "${genericContext}"`);
        }
        
        const finalContentContext = contentContext.length >= 5 
          ? contentContext 
          : `${context.seasonalFocus || 'seasonal'} garden plants and flowers for display`;
        
        console.log(`   Content: "${finalContentContext.substring(0, 60)}..."`);
        console.log(`   Title: "${contentTitle}"`);
        console.log(`   Excluded IDs: [${Array.from(usedImageIds).join(', ')}]`);
        
        // Use the same image generation service as social posts with exclusion list
        const result = await imageGenerationService.fetchImageForChannel({
          channel: 'newsletter',
          contentContext: finalContentContext,
          contentTitle: contentTitle,
          useAIKeywords: true,
          fallbackKeywords: ['garden plants flowers', 'garden center nursery', 'seasonal gardening'],
          excludeImageIds: Array.from(usedImageIds)
        });
        
        if (result && result.imageUrl) {
          console.log(`✅ Block ${blockIndex}: Got unique image ${result.imageId}`);
          
          // PHASE 4: Update this specific block with the image while preserving content
          setBlocks(prev => prev.map((b, i) => {
            if (i === blockIndex) {
              return {
                ...b, // Preserve ALL existing properties including content
                imageUrl: result.imageUrl,
                imageId: result.imageId,
                altText: result.metadata?.usedQuery || contentTitle,
                isLoadingImage: false,
                isGeneratingImage: false, // ✅ Clear generating flag once image is ready
                // CRITICAL: Preserve content flags
                hasGeneratedContent: b.hasGeneratedContent || !!(b.headline || b.body),
                contentGeneratedAt: b.contentGeneratedAt,
                contentVersion: b.contentVersion
              };
            }
            return b;
          }));
          
          // Add to used images tracker
          if (result.imageId) {
            setUsedImageIds(prev => new Set([...prev, result.imageId!]));
            console.log(`🔒 Locked image ${result.imageId} (now ${usedImageIds.size + 1} used)`);
          }
          
        } else {
          console.warn(`⚠️ No image returned for block ${blockIndex}`);
          setBlocks(prev => prev.map((b, i) => 
            i === blockIndex 
              ? { ...b, imageUrl: '', isLoadingImage: false, isGeneratingImage: false }
              : b
          ));
        }
        
        // Small delay between requests to avoid rate limiting
        if (iteration < blocksNeedingImages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
      } catch (blockError) {
        console.error(`❌ Failed to generate image for block ${blockIndex}:`, blockError);
        
        // Clear loading state for this block
        setBlocks(prev => prev.map((b, i) => {
          if (i === blockIndex) {
            return { ...b, imageUrl: '', isLoadingImage: false, isGeneratingImage: false };
          }
          return b;
        }));
      }
    }
    
    console.log(`\n✅ Image generation complete! Used ${usedImageIds.size} unique images`);
    
  } catch (error) {
    console.error('❌ Image generation failed:', error);
    // Clear all loading states on error
    setBlocks(prev => prev.map(b => 
      (b as any).shouldFetchImage 
        ? { ...b, imageUrl: '', isLoadingImage: false, isGeneratingImage: false }
        : b
    ));
  }
}

// Helper function to fetch image for blocks with missing images
// DETERMINISTIC IMAGE BEHAVIOR - respects autoImageMode and shouldFetchImage
const getOrFetchImage = async (contentObj: any, block: any): Promise<string | null> => {
  const blockType = block.block_type || block.type;
  const isHeader = blockType === 'header' || blockType === 'newsletter-header';
  
  // CRITICAL: Never fetch images for plain text blocks
  if (blockType === 'text') {
    console.log(`📝 Skipping image fetch for plain text block ${block.id}`);
    return null;
  }

  // RULE 1: If autoImageMode is false, never fetch images
  // Return whatever image the block currently has
  if (contentObj?.autoImageMode === false) {
    const existingImage = isHeader 
      ? (contentObj.backgroundImageUrl || block.image_url)
      : (contentObj.imageUrl || block.image_url);
    console.log(`🚫 autoImageMode=false for block ${block.id}, returning existing: ${existingImage ? 'has image' : 'null'}`);
    return existingImage || null;
  }

  // RULE 2: If shouldFetchImage is explicitly false, never fetch
  if (contentObj?.shouldFetchImage === false) {
    console.log(`🚫 shouldFetchImage=false for block ${block.id}, skipping fetch`);
    const existingImage = isHeader 
      ? (contentObj.backgroundImageUrl || block.image_url)
      : (contentObj.imageUrl || block.image_url);
    return existingImage || null;
  }

  // Check for existing valid image URL (from content OR from database column)
  const existingImageUrl = isHeader
    ? (contentObj?.backgroundImageUrl || block.image_url)
    : (contentObj?.imageUrl || block.image_url);
    
  // RULE 3: If autoImageMode is true and an image already exists, return it
  if (existingImageUrl && existingImageUrl.trim() !== '') {
    console.log(`✅ Found existing image for block ${block.id}: ${existingImageUrl.substring(0, 50)}...`);
    return existingImageUrl;
  }

  // RULE 4: Only fetch if shouldFetchImage is true AND no image exists
  if (contentObj?.shouldFetchImage !== true) {
    console.log(`🚫 No image and shouldFetchImage !== true for block ${block.id}, returning null`);
    return null;
  }

  // Generate image based on block content
  const searchQuery = contentObj?.headline || contentObj?.title || contentObj?.body || 'garden plants';
  console.log(`🖼️ Fetching image for block ${block.id} with query: "${searchQuery}"`);
  
  try {
    const imageData = await fetchSmartImage(searchQuery, '', true);
    if (imageData?.url) {
      // Save the image URL back to the database
      const updateContent = {
        ...contentObj,
        shouldFetchImage: false, // Clear flag after successful fetch
        autoImageMode: true, // Mark as auto-mode
      };
      
      if (isHeader) {
        updateContent.backgroundImageUrl = imageData.url;
      } else {
        updateContent.imageUrl = imageData.url;
      }
      updateContent.altText = imageData.alt;
      
      const { error } = await supabase
        .from('campaign_blocks')
        .update({ 
          content: updateContent,
          image_url: imageData.url
        })
        .eq('id', block.id);

      if (error) {
        console.warn('Failed to save image URL to database:', error);
      } else {
        console.log(`✅ Saved image URL for block ${block.id}`);
      }

      return imageData.url;
    }
  } catch (error) {
    console.warn('Failed to fetch image:', error);
  }

  return null;
};

// Post type rotation for varied content styles
const POST_TYPE_ROTATION = ['instagram', 'facebook', 'blog', 'video', 'newsletter'];

// Generate appropriate preheader text based on content and campaign name
const generatePreheaderText = (content: string, campaignName: string): string => {
  const lowerContent = content.toLowerCase();
  const lowerCampaign = campaignName.toLowerCase();
  
  // Check for specific plant types
  if (lowerContent.includes('hydrangea') || lowerCampaign.includes('hydrangea')) {
    return 'Essential tips for planting and caring for beautiful hydrangeas in your garden';
  }
  
  if (lowerContent.includes('rose') || lowerCampaign.includes('rose')) {
    return 'Expert advice for growing stunning roses all season long';
  }
  
  if (lowerContent.includes('tomato') || lowerCampaign.includes('tomato')) {
    return 'Everything you need to know for a successful tomato harvest';
  }
  
  // Check for general gardening activities
  if (lowerContent.includes('planting') || lowerCampaign.includes('planting')) {
    return 'Professional planting techniques for your garden success';
  }
  
  if (lowerContent.includes('care') || lowerCampaign.includes('care')) {
    return 'Expert care tips for thriving plants and gardens';
  }

  if (lowerContent.includes('summer')) {
    return 'Summer gardening tips to keep your plants thriving in the heat';
  }
  
  if (lowerContent.includes('spring')) {
    return 'Spring preparation guides for a successful growing season';
  }
  
  return 'Expert gardening tips delivered to your inbox';
};

// Auto-fill header with campaign title for new newsletters
const autoFillHeaderTitle = (blocks: ContentBlock[], campaignTitle: string): ContentBlock[] => {
  if (!campaignTitle || campaignTitle === 'Newsletter Campaign') return blocks;
  
  // Sanitize the title to remove week number references
  const sanitizedTitle = sanitizeCampaignTitle(campaignTitle);
  
  return blocks.map(block => {
    if (block.type === 'header' && (!block.title || block.title === 'Campaign Title' || block.title === '')) {
      return {
        ...block,
        title: sanitizedTitle,
        headline: sanitizedTitle
      };
    }
    return block;
  });
};

// Extract gardening-specific keywords from text content
const extractGardenKeywords = (text: string): string[] => {
  if (!text) return [];
  
  const lowerText = text.toLowerCase();
  const PRIORITY_TERMS = [
    // Flowers
    'hydrangea', 'hydrangeas', 'rose', 'roses', 'tulip', 'tulips', 'daffodil', 'lavender',
    'peony', 'peonies', 'dahlia', 'dahlias', 'sunflower', 'sunflowers', 'lily', 'lilies',
    // Vegetables and herbs
    'tomato', 'tomatoes', 'pepper', 'lettuce', 'basil', 'rosemary', 'carrot', 'cucumber',
    // Activities
    'pruning', 'planting', 'fertilizing', 'mulching', 'composting', 'watering', 'harvesting',
    // Seasons
    'winter', 'spring', 'summer', 'fall', 'autumn', 'frost', 'seasonal',
    // Garden elements
    'greenhouse', 'compost', 'tools', 'soil', 'seeds', 'seedling'
  ];
  
  return PRIORITY_TERMS.filter(term => lowerText.includes(term));
};

// Create contextual image queries for weekly theme newsletters
// Mimics the successful AIWriterDialog.createImageKeywords approach
const createWeeklyThemeImageQuery = (
  weekContext: {
    title: string;
    description: string;
    seasonalFocus: string;
    heroQuery?: string;
    weekNumber?: number;
  },
  blockContent: {
    headline?: string;
    body?: string;
  },
  blockIndex: number,
  totalBlocks: number
): string => {
  // Use the FULL week theme title as the primary topic (not just extracted keywords)
  const topicKeywords = weekContext.title.toLowerCase();
  
  console.log(`🎨 Creating image query for: "${weekContext.title}" (block ${blockIndex + 1}/${totalBlocks})`);
  
  // Check for special topics that need specific handling
  // Holiday/seasonal themes
  if (topicKeywords.includes('holiday') || topicKeywords.includes('christmas') || 
      topicKeywords.includes('decorations') || topicKeywords.includes('celebrations')) {
    const holidaySectionKeywords: { [key: number]: string } = {
      0: `${weekContext.title} featured display garden center`,
      1: `${weekContext.title} arrangements natural evergreen`,
      2: `${weekContext.title} garden elements festive`,
      3: `${weekContext.title} seasonal plants display`
    };
    const query = holidaySectionKeywords[blockIndex] || `${weekContext.title} garden`;
    console.log(`🎄 Holiday theme query: "${query}"`);
    return query;
  }
  
  // Winter/frost themes
  if (topicKeywords.includes('winter') || topicKeywords.includes('frost') || 
      topicKeywords.includes('cold') || topicKeywords.includes('protection')) {
    const winterSectionKeywords: { [key: number]: string } = {
      0: `${weekContext.title} featured winter garden`,
      1: `${weekContext.title} protection mulching`,
      2: `${weekContext.title} garden tools winter`,
      3: `${weekContext.title} healthy plants cold weather`
    };
    const query = winterSectionKeywords[blockIndex] || `${weekContext.title} garden`;
    console.log(`❄️ Winter theme query: "${query}"`);
    return query;
  }
  
  // Hydrangea (known problematic case with specific handling)
  if (topicKeywords.includes('hydrangea')) {
    const hydrangeaSectionKeywords: { [key: number]: string } = {
      0: 'hydrangea featured summer garden',
      1: 'hydrangea care tips pruning',
      2: 'hydrangea garden center display varieties',
      3: 'hydrangea healthy plants blooming'
    };
    const query = hydrangeaSectionKeywords[blockIndex] || 'hydrangea summer garden';
    console.log(`💐 Hydrangea theme query: "${query}"`);
    return query;
  }
  
  // Check if AI-generated block content has specific plant/topic mentions
  const blockText = `${blockContent.headline || ''} ${blockContent.body || ''}`.toLowerCase();
  const specificKeywords = extractGardenKeywords(blockText);
  
  if (specificKeywords.length > 0 && specificKeywords[0] !== topicKeywords.split(' ')[0]) {
    // Block content mentions a different specific plant/topic
    const specificTopic = specificKeywords[0];
    console.log(`🌿 Found specific topic in block content: "${specificTopic}"`);
    const sectionKeywords: { [key: number]: string } = {
      0: `${specificTopic} ${weekContext.seasonalFocus} featured beautiful`,
      1: `${specificTopic} care growing tips garden`,
      2: `${specificTopic} garden center display nursery`,
      3: `${specificTopic} healthy plants ${weekContext.seasonalFocus}`
    };
    const query = sectionKeywords[blockIndex] || `${specificTopic} ${weekContext.seasonalFocus} garden`;
    console.log(`🔍 Specific topic query: "${query}"`);
    return query;
  }
  
  // Default: Use full week title with descriptive modifiers based on block position
  const sectionKeywords: { [key: number]: string } = {
    0: `${weekContext.title} featured beautiful garden`, // Hero/Featured
    1: `${weekContext.title} ${weekContext.seasonalFocus} care tips`, // Main content
    2: `${weekContext.title} garden center display`, // Secondary
    3: `${weekContext.title} healthy plants nursery` // CTA
  };
  
  const query = sectionKeywords[blockIndex] || `${weekContext.title} ${weekContext.seasonalFocus} garden`;
  console.log(`🌱 Default query: "${query}"`);
  return query;
};

// Normalize blocks to ensure consistency - convert all to image-text for weekly themes
// PHASE 1: Updated to respect user content and lifecycle flags
const normalizeBlocks = (blocks: ContentBlock[]): ContentBlock[] => {
  return blocks.map(block => {
    // CRITICAL CHANGE: Convert all content blocks to image-text for weekly themes
    if (block.type === 'image-text' || block.type === 'image') {
      // Extract headline from content if not already present
      let headline = block.headline || block.title || '';
      if (!headline && (block.content || block.body)) {
        const textContent = block.content || block.body || '';
        // Try to extract first line as headline if it looks like a heading
        const lines = textContent.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
          const firstLine = lines[0].trim();
          // If first line is short and looks like a heading, use it as headline
          if (firstLine.length < 100 && firstLine.length > 5) {
            headline = firstLine.replace(/^#+\s*/, '').replace(/^\*\*(.*?)\*\*$/, '$1'); // Remove markdown
          }
        }
      }
      
      // CRITICAL FIX: Only set default if content was never generated AND user hasn't edited
      // Respect empty strings if userEdited is true (user intentionally cleared the field)
      if (!headline && !block.hasGeneratedContent && !block.userEdited) {
        headline = 'Content Headline';
      }
      
      const body = block.body || block.content || '';
      // Only set default body if no content, never generated, and user hasn't edited
      const finalBody = (!body && !block.hasGeneratedContent && !block.userEdited) 
        ? 'Add your content here' 
        : body;
      
      console.log(`🔄 Normalizing text block ${block.id}, hasGeneratedContent: ${!!block.hasGeneratedContent}, userEdited: ${!!block.userEdited}`);
      
      return {
        ...block,
        type: 'image-text' as const, // Convert to image-text for weekly themes
        layout: block.layout || 'full-width',
        headline: headline || block.headline,
        body: finalBody || block.body,
        imageUrl: block.imageUrl || '',
        shouldFetchImage: !block.imageUrl, // Only fetch if no image
        isGeneratingImage: block.isGeneratingImage || false, // Preserve existing state
        isWeeklyTheme: true,
        hasGeneratedContent: block.hasGeneratedContent || !!(headline || body)
      };
    }
    
    return block;
  });
};

interface CRMCampaignCreatorProps {
  campaignSlug?: string;
  contentTaskId?: string | null;
}

export const CRMCampaignCreator: React.FC<CRMCampaignCreatorProps> = ({ 
  campaignSlug, 
  contentTaskId: propContentTaskId 
}) => {
  console.log('🚨🚨🚨 COMPONENT DEBUG: CRMCampaignCreator mounted at', new Date().toISOString());
  console.log('🚨 COMPONENT DEBUG: campaignSlug =', campaignSlug);
  console.log('🚨 COMPONENT DEBUG: contentTaskId =', propContentTaskId);
  
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  console.log('🚨 COMPONENT DEBUG: searchParams =', searchParams.toString());
  
  // 🚨 UNIFIED PREFILL LOGIC - Single source of truth for all prefill sources
  // Parse prefill sources ONCE during render (not in effects)
  const typeParam = searchParams.get('type');
  const prefillDataParam = searchParams.get('prefillData');
  const bundleIdParam = searchParams.get('bundleId');
  const urlContentTaskId = searchParams.get('contentTaskId');
  const templateIdParam = searchParams.get('templateId');
  const finalContentTaskId = propContentTaskId || urlContentTaskId;

  // Parse URL personas early
  const personaParam = searchParams.get('persona');
  const segmentIdParam = searchParams.get('segment');
  
  let initialPersonas: any[] = [];
  if (personaParam) {
    try {
      initialPersonas = [JSON.parse(decodeURIComponent(personaParam))];
      console.log('🎯 Parsed persona from URL:', initialPersonas);
    } catch (error) {
      console.error('❌ Failed to parse persona parameter:', error);
    }
  }

const { counts: segmentCounts } = useSegmentCounts();
  
  const [campaignName, setCampaignName] = useState('');
  
  // Track used images to prevent duplicates
  const [usedImageIds, setUsedImageIds] = useState<Set<string>>(new Set());
  
  // CRITICAL: Track lastModifiedAt for DB vs localStorage coordination
  const [lastModifiedAt, setLastModifiedAt] = useState<string>(new Date().toISOString());
  
  // UNIFIED PREFILL REF - Ensures prefill runs exactly once
  const hasAppliedPrefillRef = useRef(false);
  
  // Draft restoration dialog state
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [pendingDraftData, setPendingDraftData] = useState<{
    state: any;
    draftTimestamp?: string;
    dbTimestamp?: string;
  } | null>(null);
  
  // CRITICAL FIX: Generate unique session ID for new campaigns to prevent cross-contamination
  // Uses helper function that ensures:
  // - Existing campaigns (UUID slug) use campaignSlug as session ID
  // - New campaigns get unique session ID that cannot collide with other campaigns
  const sessionIdRef = useRef<string | null>(null);
  if (sessionIdRef.current === null) {
    sessionIdRef.current = generateCampaignSessionId(campaignSlug);
    console.log(`🔑 Generated session ID: ${sessionIdRef.current} for slug: ${campaignSlug || 'new'}`);
  }
  
  // Reset tracker when campaign changes
  useEffect(() => {
    setUsedImageIds(new Set());
  }, [campaignSlug]);
  
  // Page persistence hook with unique session ID and lastModifiedAt support
  const { persistState, restoreState, clearPersistedState, getPersistedTimestamp } = usePagePersistence<{
    campaignName: string;
    subjectLine: string;
    preheaderText: string;
    blocks: ContentBlock[];
    showPreview: boolean;
    selectedPersonas: any[];
    selectedSegments: any[];
    flow?: string;
  }>({
    key: 'campaign_creator',
    sessionId: sessionIdRef.current,
    ttl: 2 * 60 * 60 * 1000, // 2 hours
    onHidden: () => {
      // Persist with current lastModifiedAt
      persistState({
        campaignName,
        subjectLine,
        preheaderText,
        blocks,
        showPreview,
        selectedPersonas,
        selectedSegments,
        flow: searchParams.get('flow') || undefined
      }, lastModifiedAt);
    }
  });
  
  const { query: bundleQuery } = useGeneratedBundle(bundleIdParam || undefined);
  
  const [subjectLine, setSubjectLine] = useState('');
  const [preheaderText, setPreheaderText] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  
  // UNIFIED PREFILL EFFECT - Runs exactly once when component mounts
  // Handles: URL prefillData, bundleId, templateId, contentTaskId
  useEffect(() => {
    if (hasAppliedPrefillRef.current) {
      console.log('🚫 Prefill already applied, skipping');
      return;
    }
    
    // Handle prefillData from URL (direct newsletter prefill)
    if (typeParam === 'newsletter' && prefillDataParam) {
      try {
        const prefillData = JSON.parse(decodeURIComponent(prefillDataParam));
        console.log('🚨 UNIFIED PREFILL: Applying newsletter prefill data');
        
        const headerBlock: ContentBlock = {
          id: `prefill-header-${Date.now()}`,
          type: 'header' as const,
          title: prefillData.title || 'Newsletter Campaign',
          headline: prefillData.title || 'Newsletter Campaign',
          source: 'manual' as const,
          status: 'empty'
        };
        
        const contentBlock: ContentBlock = {
          id: `prefill-content-${Date.now()}`,
          type: 'image-text' as const,
          layout: 'image-left' as const,
          headline: 'Newsletter Content',
          body: prefillData.content || 'Your newsletter content will appear here.',
          imageUrl: prefillData.featuredImage || '',
          source: 'manual' as const,
          status: prefillData.content ? 'ai-generated' : 'empty'
        };
        
        setBlocks([headerBlock, contentBlock]);
        setCampaignName(prefillData.title || 'Newsletter Campaign');
        setSubjectLine(prefillData.title || 'Newsletter Campaign');
        setPreheaderText(`${prefillData.title || 'Newsletter'} - Expert insights delivered to your inbox`);
        
        // Mark prefill as applied and update timestamp
        hasAppliedPrefillRef.current = true;
        setLastModifiedAt(new Date().toISOString());
        
        // Clean URL
        const url = new URL(window.location.href);
        url.searchParams.delete('prefillData');
        window.history.replaceState({}, '', url.toString());
        
        toast({
          title: 'Newsletter content loaded!',
          description: `Successfully loaded: "${prefillData.title}"`
        });
        
      } catch (error) {
        console.error('🚨 UNIFIED PREFILL: Parse error', error);
      }
    }
    
    // Note: Other prefill sources (bundleId, templateId, contentTaskId) are handled
    // in their respective useEffects but they check hasAppliedPrefillRef first
    
  }, [typeParam, prefillDataParam, toast]);
  
  const [selectedPersonas, setSelectedPersonas] = useState<any[]>(() => {
    return initialPersonas;
  });
  const [selectedSegments, setSelectedSegments] = useState<any[]>([]);
  
  // Initialize selectedSegments from URL
  useEffect(() => {
    const loadSegmentFromUrl = async () => {
      if (!segmentIdParam) {
        console.log('🔍 No segmentId in URL params');
        return;
      }
      
      try {
        console.log('🔄 Loading segment from URL:', segmentIdParam);
        console.log('🔄 Current selectedSegments length:', selectedSegments.length);
        
        // Check if it's a predefined segment (string ID) or custom segment (UUID format)
        const isCustomSegment = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segmentIdParam);
        console.log('🔍 Is custom segment:', isCustomSegment);
        
        if (isCustomSegment) {
          // Fetch custom segment
          console.log('🔍 Fetching custom segment from database...');
          const { data: segmentData, error } = await supabase
            .from('crm_segments')  // Changed from custom_segments to crm_segments
            .select('*')
            .eq('id', segmentIdParam)
            .maybeSingle();
            
          console.log('🔍 Custom segment query result:', { segmentData, error });
            
          if (error) {
            console.error('❌ Error fetching custom segment:', error);
            return;
          }
          
          if (segmentData) {
            // Get actual customer count for this segment
            const { count: customerCount, error: countError } = await supabase
              .from('customer_segments')
              .select('*', { count: 'exact', head: true })
              .eq('segment_id', segmentData.id);

            if (countError) {
              console.error('❌ Error counting customers for segment:', countError);
            }

            console.log('🎯 Setting selected segment from URL with count:', { segmentData, customerCount });
            setSelectedSegments([{
              id: segmentData.id,
              name: segmentData.name,
              type: 'custom',
              customer_count: customerCount || 0  // Use customer_count to match AudienceSelector
            }]);
          } else {
            console.log('⚠️ Custom segment not found in database');
          }
        } else {
          // Handle predefined segment - match exact names from CustomerSegmentsSection
          const predefinedSegments = {
            'new-customers': { name: 'New Customers', id: 'new-customers' },
            'loyalty-members': { name: 'Loyalty Members', id: 'loyalty-members' },
            'high-value': { name: 'High-Value Customers', id: 'high-value' }, // Fixed: was 'High Value Customers'
            'lapsed-customers': { name: 'Lapsed Customers', id: 'lapsed-customers' },
            'seasonal-shoppers': { name: 'Seasonal Shoppers', id: 'seasonal-shoppers' },
            'frequent-buyers': { name: 'Frequent Buyers', id: 'frequent-buyers' }
          };
          
          console.log('🔍 Looking for predefined segment:', segmentIdParam);
          const predefinedSegment = predefinedSegments[segmentIdParam as keyof typeof predefinedSegments];
          if (predefinedSegment) {
            // Get the actual count from segmentCounts hook
            const actualCount = segmentCounts[segmentIdParam as keyof typeof segmentCounts] || 0;
            
            console.log('🎯 Setting predefined segment from URL with count:', { predefinedSegment, actualCount });
            setSelectedSegments([{
              id: predefinedSegment.id,
              name: predefinedSegment.name,
              type: 'predefined',
              customer_count: actualCount  // Use customer_count to match AudienceSelector
            }]);
          } else {
            console.log('⚠️ Predefined segment not found:', segmentIdParam);
          }
        }
      } catch (error) {
        console.error('❌ Error loading segment from URL:', error);
      }
    };
    
    // Always try to load if we have a segmentIdParam, regardless of current selectedSegments length
    if (segmentIdParam) {
      loadSegmentFromUrl();
    }
  }, [segmentIdParam, supabase, segmentCounts]); // Added segmentCounts dependency

  // Initialize selectedPersonas from URL only once - don't override user selections
  useEffect(() => {
    console.log('🔄 useEffect for personas initialization. InitialPersonas:', initialPersonas, 'Current selectedPersonas:', selectedPersonas);
    if (initialPersonas.length > 0 && selectedPersonas.length === 0) {
      console.log('🔄 Initializing selectedPersonas from URL:', initialPersonas);
      setSelectedPersonas(initialPersonas);
    }
    // Removed the logic that keeps overriding user selections with URL personas
  }, [initialPersonas]);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | undefined>();
  const [saveError, setSaveError] = useState(false);
  const [sourceContentInfo, setSourceContentInfo] = useState<{
    taskId: string;
    campaignTitle: string;
    contentPreview: string;
  } | null>(null);
  const [existingCampaignId, setExistingCampaignId] = useState<string | null>(null);
  const [loadingExistingCampaign, setLoadingExistingCampaign] = useState(false);
  const [generatingBlocks, setGeneratingBlocks] = useState<Set<string>>(new Set());
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showAIWriter, setShowAIWriter] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSenderConfirmation, setShowSenderConfirmation] = useState(false);
  const [showAIImageDialog, setShowAIImageDialog] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  

  // Sender configuration for domain verification
  const { senderConfig, loading: loadingSenderConfig } = useSenderConfiguration();

  // Footer and company data - pass campaignId to load campaign-specific styling
  const { footerSettings, campaignOverrides, setCampaignOverrides } = useFooterSettings(existingCampaignId || undefined);
  const { companyInfo } = useCompanyInfo();
  
  // Log company info changes for debugging footer issues
  useEffect(() => {
    console.log('🏢 Company info loaded/updated:', {
      name: companyInfo?.name,
      address: companyInfo?.address,
      phone: companyInfo?.phone
    });
  }, [companyInfo]);

  // Auto-save functionality with queue-based protection
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const { enqueueSave, cancelPendingSaves } = useSaveQueue();

  const autoSaveCampaign = useCallback(async (campaignData: {
    blocks: ContentBlock[];
    campaign_name: string;
    subject_line: string;
    preheader: string;
  }) => {
    if (!existingCampaignId) {
      console.log('🚫 Auto-save skipped: no campaign ID');
      return;
    }
    
    // Enqueue the save operation to prevent race conditions
    return enqueueSave(async () => {
      let retryCount = 0;
      const maxRetries = 3;
      
      const attemptSave = async (): Promise<void> => {
        try {
          setIsAutoSaving(true);
          console.log('🔄 Auto-save attempt', retryCount + 1, 'for campaign:', existingCampaignId);
          
          // Validate required fields
          if (!campaignData.campaign_name?.trim()) {
            throw new Error('Campaign name is required');
          }

          // Step 1: Update campaign metadata
          console.log('📝 Updating campaign metadata...');
          const { error: campaignError } = await supabase
            .from('crm_campaigns')
            .update({
              name: campaignData.campaign_name,
              subject_line: campaignData.subject_line,
              preheader: campaignData.preheader,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingCampaignId);

          if (campaignError) {
            console.error('❌ Campaign update failed:', campaignError);
            throw new Error(`Campaign update failed: ${campaignError.message}`);
          }
          console.log('✅ Campaign metadata updated successfully');

          // Step 2: Save blocks separately - update existing, insert new
          console.log('📦 Saving', campaignData.blocks.length, 'blocks...');
          
          if (campaignData.blocks.length > 0) {
            // Fetch existing blocks to preserve their IDs
            const { data: existingBlocks } = await supabase
              .from('campaign_blocks')
              .select('id, order_index')
              .eq('campaign_id', existingCampaignId);

            const existingBlockMap = new Map(
              (existingBlocks || []).map(b => [b.order_index, b.id])
            );

            const blocksToUpdate: any[] = [];
            const blocksToInsert: any[] = [];

            campaignData.blocks.forEach((block, index) => {
              const existingId = existingBlockMap.get(index);
              
              // CANONICAL: Use normalizeBlockForSave for consistent field mapping
              const normalizedBlock = normalizeBlockForSave(block, index);
              const blockData = {
                campaign_id: existingCampaignId,
                ...normalizedBlock
              };

              // Validate required fields
              if (!blockData.block_type) {
                throw new Error(`Block ${index} is missing required block_type`);
              }

              if (existingId) {
                // Update existing block
                blocksToUpdate.push({ ...blockData, id: existingId });
              } else {
                // Insert new block
                blocksToInsert.push(blockData);
              }
            });

            // Delete blocks that are no longer needed
            const { error: deleteError } = await supabase
              .from('campaign_blocks')
              .delete()
              .eq('campaign_id', existingCampaignId)
              .gte('order_index', campaignData.blocks.length);

            if (deleteError) {
              console.warn('⚠️ Failed to delete extra blocks:', deleteError);
            }

            // Update existing blocks
            if (blocksToUpdate.length > 0) {
              for (const block of blocksToUpdate) {
                const { error: updateError } = await supabase
                  .from('campaign_blocks')
                  .update(block)
                  .eq('id', block.id);

                if (updateError) {
                  console.error('❌ Block update failed:', updateError);
                  throw new Error(`Block update failed: ${updateError.message}`);
                }
              }
              console.log('✅ Updated', blocksToUpdate.length, 'existing blocks');
            }

            // Insert new blocks
            if (blocksToInsert.length > 0) {
              const { error: insertError } = await supabase
                .from('campaign_blocks')
                .insert(blocksToInsert);

              if (insertError) {
                console.error('❌ Block insert failed:', insertError);
                throw new Error(`Block insert failed: ${insertError.message}`);
              }
              console.log('✅ Inserted', blocksToInsert.length, 'new blocks');
            }
          } else {
            // Delete all blocks if none provided
            await supabase
              .from('campaign_blocks')
              .delete()
              .eq('campaign_id', existingCampaignId);
          }

          setLastSaved(new Date());
          setSaveError(false);
          console.log('✅ Auto-save completed successfully');
          
        } catch (error: any) {
          console.error('❌ Auto-save error (attempt', retryCount + 1, '):', error);
          
          const isRetryable = error?.message?.includes('network') || 
                             error?.message?.includes('timeout') ||
                             error?.message?.includes('temporary');
          
          if (retryCount < maxRetries && isRetryable) {
            retryCount++;
            console.log('🔄 Retrying auto-save in 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            return attemptSave();
          }
          
          setSaveError(true);
          
          let errorMessage = "Your changes may not be saved. Please try again.";
          if (error?.message?.includes('Campaign name is required')) {
            errorMessage = "Campaign name is required to save.";
          } else if (error?.message?.includes('network')) {
            errorMessage = "Network error. Check your connection and try again.";
          } else if (error?.message?.includes('Block') && error?.message?.includes('missing')) {
            errorMessage = "Some blocks have invalid data. Please check your content.";
          }
          
          toast({
            title: "Auto-save failed",
            description: errorMessage,
            variant: "destructive"
          });
          
          throw error;
        } finally {
          setIsAutoSaving(false);
        }
      };

      return attemptSave();
    });
  }, [existingCampaignId, enqueueSave, toast]);

  // Immediate save for critical updates like image generation
  // Uses a 500ms batching window to collect concurrent image saves
  const imageSaveBatchRef = useRef<{
    timeout: NodeJS.Timeout | null;
    pendingBlocks: ContentBlock[] | null;
  }>({ timeout: null, pendingBlocks: null });

  const immediateAutoSave = useCallback((campaignData: {
    blocks: ContentBlock[];
    campaign_name: string;
    subject_line: string;
    preheader: string;
  }) => {
    if (!existingCampaignId) return;

    // Cancel any pending debounced saves to avoid conflicts
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    // Store latest blocks for batching
    imageSaveBatchRef.current.pendingBlocks = campaignData.blocks;

    // If there's already a batch timeout, let it handle the save
    if (imageSaveBatchRef.current.timeout) {
      console.log('💾 [ImmediateSave] Batching image save...');
      return;
    }

    // Set up batch window - wait 500ms to collect concurrent image updates
    imageSaveBatchRef.current.timeout = setTimeout(() => {
      const blocksToSave = imageSaveBatchRef.current.pendingBlocks;
      imageSaveBatchRef.current.timeout = null;
      imageSaveBatchRef.current.pendingBlocks = null;

      if (blocksToSave) {
        console.log('💾 [ImmediateSave] Executing batched save for images...');
        autoSaveCampaign({
          blocks: blocksToSave,
          campaign_name: campaignData.campaign_name,
          subject_line: campaignData.subject_line,
          preheader: campaignData.preheader
        });
      }
    }, 500);
  }, [existingCampaignId, autoSaveCampaign]);

  // Handler for AI-generated content
  const handleAIContentGenerated = async (aiData: {
    campaignName: string;
    subjectLine: string;
    preheaderText: string;
    blocks: ContentBlock[];
  }) => {
    console.log('🤖 AI content generated, images will follow...', aiData);
    
    // Update campaign fields
    setCampaignName(aiData.campaignName);
    setSubjectLine(aiData.subjectLine);
    setPreheaderText(aiData.preheaderText);
    setBlocks(aiData.blocks);
    
    // If we have an existing campaign, trigger auto-save
    if (existingCampaignId) {
      debouncedAutoSave({
        blocks: aiData.blocks,
        campaign_name: aiData.campaignName,
        subject_line: aiData.subjectLine,
        preheader: aiData.preheaderText
      });
    }
  };

  // Handle progressive image updates as they complete
  const handleBlockImageGenerated = (blockId: string, imageUrl: string) => {
    console.log(`✅ [CampaignCreator] Block image generated for ${blockId}, updating blocks...`);
    setBlocks(prevBlocks => {
      console.log(`📊 [CampaignCreator] Current blocks before update:`, {
        totalBlocks: prevBlocks.length,
        blockWithMatchingId: prevBlocks.find(b => b.id === blockId)?.type,
        allBlockIds: prevBlocks.map(b => b.id)
      });

      const updatedBlocks = prevBlocks.map(block => {
        if (block.id === blockId) {
          // CRITICAL FIX: For header blocks, update backgroundImageUrl; for others, update imageUrl
          const isHeaderBlock = block.type === 'header' || block.type === 'newsletter-header';
          
          console.log(`🔧 [CampaignCreator] Updating block ${blockId}:`, {
            isHeaderBlock,
            currentImageUrl: block.imageUrl,
            currentBackgroundImageUrl: block.backgroundImageUrl,
            newImageUrl: imageUrl,
            wasGenerating: block.isGeneratingImage
          });

          return {
            ...block,
            ...(isHeaderBlock 
              ? { backgroundImageUrl: imageUrl || undefined }
              : { imageUrl: imageUrl || undefined }
            ),
            isGeneratingImage: false,
            imageGenerationError: undefined,
            // DETERMINISTIC IMAGE BEHAVIOR: Clear shouldFetchImage after generation
            shouldFetchImage: false,
            // Keep autoImageMode as is - it was set when generation was triggered
          };
        }
        return block;
      });
      
      // CRITICAL FIX: Use IMMEDIATE save (not debounced) for image generation
      // Images must be persisted immediately to survive page refreshes
      if (existingCampaignId && imageUrl) {
        console.log('💾 [ImmediateSave] Saving image immediately for block:', blockId);
        immediateAutoSave({
          blocks: updatedBlocks,
          campaign_name: campaignName,
          subject_line: subjectLine,
          preheader: preheaderText
        });
      }
      
      return updatedBlocks;
    });
  };

  // Handle image generation failures
  const handleBlockImageFailed = (blockId: string, error: string) => {
    console.log(`❌ Block image failed for ${blockId}:`, error);
    setBlocks(prevBlocks =>
      prevBlocks.map(block =>
        block.id === blockId
          ? { ...block, isGeneratingImage: false, imageGenerationError: error }
          : block
      )
    );
  };

  // Retry image generation for a failed block
  const retryImageGeneration = async (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    console.log(`🔄 Retrying image generation for block ${blockId}`);

    // Mark as generating
    setBlocks(prevBlocks =>
      prevBlocks.map(b =>
        b.id === blockId
          ? { ...b, isGeneratingImage: true, imageGenerationError: undefined }
          : b
      )
    );

    try {
      const contentContext = (block.body || block.content || campaignName).trim();
      const contentTitle = (block.headline || block.title || campaignName).trim();

      const { data, error } = await supabase.functions.invoke('generate-ai-image', {
        body: {
          contentContext,
          contentTitle,
          channel: 'newsletter',
          uploadToStorage: true,
        }
      });

      if (error) throw error;

      handleBlockImageGenerated(blockId, data.imageUrl);

      toast({
        title: "Image Generated",
        description: "Successfully generated the image.",
      });

    } catch (error: any) {
      handleBlockImageFailed(blockId, error.message);

      toast({
        title: "Generation Failed",
        description: "Could not generate image. Please try again.",
        variant: "destructive"
      });
    }
  };

  const debouncedAutoSave = useCallback((campaignData: {
    blocks: ContentBlock[];
    campaign_name: string;
    subject_line: string;
    preheader: string;
  }) => {
    // Cancel any pending auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Increased debounce time from 2s to 5s to reduce rapid saves
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveCampaign(campaignData);
    }, 5000);
  }, [autoSaveCampaign]);


  // Cleanup timeout and pending saves on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (imageSaveBatchRef.current.timeout) {
        clearTimeout(imageSaveBatchRef.current.timeout);
      }
      cancelPendingSaves();
    };
  }, [cancelPendingSaves]);

  // Auto-enhance new newsletters without templates
  const [enhancing, setEnhancing] = useState(false);
  
  useEffect(() => {
    const route = searchParams;
    const isNewNewsletter = 
      route.get('type') === 'newsletter' &&
      !route.get('templateId') &&
      !route.get('contentTaskId') &&
      !existingCampaignId &&
      blocks.length > 0 &&
      !enhancing;
    
    if (!isNewNewsletter) return;
    
    let cancelled = false;
    
    async function enhanceAll() {
      console.log('[AI] Auto-enhance: starting for new newsletter');
      setEnhancing(true);
      
      const topic = campaignName || 
        blocks.find((b) => b.title || b.headline)?.title || 
        'Weekly Gardening Tips';
      
      try {
        const enhanced = await Promise.allSettled(
          blocks.map(async (block) => {
            if (block.type === 'header' || block.type === 'divider') {
              return block;
            }
            
            const currentIndex = blocks.indexOf(block);
            const previousBlocks = blocks.slice(0, currentIndex).filter(b => b.type !== 'header' && b.type !== 'divider');
            
            const payload = {
              prompt: `Create newsletter content for: ${topic.trim()}`,
              type: 'email_block',
              postType: 'newsletter',
              campaignTitle: topic.trim(),
              campaignContext: '',
              blockIndex: currentIndex,
              previousBlocks,
              totalBlocks: blocks.length
            };
            
            console.log('[AI] auto-enhance invoke for block:', { blockId: block.id, payload });
            const { data, error } = await supabase.functions.invoke('generate-email-content', { 
              body: payload 
            });
            
            console.log('[AI] auto-enhance response:', { blockId: block.id, error, data });
            
            if (error) return block;
            
            const { normalizeAIResponse, applyAIToBlock } = await import('@/lib/newsletter/aiMapping');
            const normalizedAI = normalizeAIResponse(data);
            let updatedBlock = applyAIToBlock(block, normalizedAI);
            
            // Defensive handling for placeholder titles
            if (updatedBlock.title === 'AI Generated Content' || !updatedBlock.title) {
              updatedBlock.title = normalizedAI.title || topic.trim() || 'Newsletter Content';
            }
            if (updatedBlock.headline === 'AI Generated Content' || !updatedBlock.headline) {
              updatedBlock.headline = normalizedAI.title || topic.trim() || 'Newsletter Content';
            }
            
            return updatedBlock;
          })
        );
        
        const enhancedBlocks = enhanced.map((result, i) => 
          result.status === 'fulfilled' ? result.value : blocks[i]
        );
        
        if (!cancelled) {
          // Apply image fallback for blocks that need images
          const blocksWithImages = await Promise.all(
            enhancedBlocks.map(async (block) => {
              if ((block.type === 'image-text' || block.type === 'hero') && !block.imageUrl) {
                const imageQuery = block.title || block.headline || campaignName || 'garden';
                try {
                  const imageData = await fetchSmartImage(imageQuery, '', true);
                  if (imageData?.url) {
                    return { ...block, imageUrl: imageData.url, altText: imageData.alt };
                  }
                } catch (error) {
                  console.warn('Failed to fetch fallback image for block:', block.id, error);
                }
              }
              return block;
            })
          );
          
          setBlocks(blocksWithImages);
          const contentCount = blocksWithImages.filter(b => (b.body || b.content)?.length).length;
          
          console.log('[AI] Auto-enhance: completed');
          toast({
            title: "AI Enhancement Complete",
            description: `Generated ${contentCount} blocks with AI content and images`,
          });
        }
      } catch (error) {
        console.error('[AI] Auto-enhance failed:', error);
        if (!cancelled) {
          toast({
            title: "Auto-enhancement failed",
            description: "Manual content editing is still available",
            variant: "destructive"
          });
        }
      } finally {
        if (!cancelled) {
          setEnhancing(false);
        }
      }
    }
    
    // Delay to ensure blocks have fully loaded
    const timer = setTimeout(enhanceAll, 1000);
    
    return () => { 
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchParams, existingCampaignId, blocks.length, campaignName, enhancing, supabase, toast]);

  // Handle direct prefill data from query parameters (SIMPLIFIED & FORCED)
  useEffect(() => {
    console.error('🚨🚨🚨 PREFILL EFFECT v2: Starting execution');
    console.error('🚨 PREFILL EFFECT v2: searchParams =', searchParams.toString());
    
    const type = searchParams.get('type');
    const prefillDataParam = searchParams.get('prefillData');
    
    console.error('🚨 PREFILL EFFECT v2: type =', type);
    console.error('🚨 PREFILL EFFECT v2: prefillData exists =', !!prefillDataParam);
    
    if (type === 'newsletter' && prefillDataParam) {
      console.error('🚨🚨🚨 PREFILL EFFECT v2: CONDITIONS MET - PROCESSING DATA');
      
      try {
        const prefillData = JSON.parse(decodeURIComponent(prefillDataParam));
        console.error('🚨 PREFILL EFFECT v2: Parsed data =', prefillData);
        
        // Create new blocks with the newsletter data
        const newBlocks: ContentBlock[] = [
          {
            id: `newsletter-header-${Date.now()}`,
            type: 'header',
            title: prefillData.title || 'Newsletter',
            headline: prefillData.title || 'Newsletter',
            source: 'manual'
          },
          {
            id: `newsletter-content-${Date.now()}`,
            type: 'image-text',
            headline: 'Newsletter Content', 
            body: prefillData.content || 'Newsletter content will appear here',
            imageUrl: prefillData.featuredImage || '',
            source: 'manual'
          }
        ];
        
        console.error('🚨 PREFILL EFFECT v2: Created blocks =', newBlocks);
        console.error('🚨 PREFILL EFFECT v2: Setting blocks now...');
        
        // Set the blocks and campaign info
        setBlocks(newBlocks);
        if (prefillData.title) {
          setCampaignName(prefillData.title);
          setSubjectLine(prefillData.title);
        }
        
        console.error('🚨🚨🚨 PREFILL EFFECT v2: BLOCKS SET SUCCESSFULLY');
        
      } catch (error) {
        console.error('🚨 PREFILL EFFECT v2: ERROR =', error);
      }
    } else {
      console.error('🚨 PREFILL EFFECT v2: Conditions not met - skipping');
    }
  }, [searchParams]);

  // Direct prefill from URL parameters  
  useEffect(() => {
    const prefillDataParam = searchParams.get('prefillData');
    if (!prefillDataParam) return;
    
    try {
      console.log('🔄 [DEBUG] Processing direct prefill data from URL');
      console.log('📜 [DEBUG] Raw prefillDataParam:', prefillDataParam);
      
      const prefillData = JSON.parse(decodeURIComponent(prefillDataParam));
      console.log('📦 [DEBUG] Parsed prefillData:', prefillData);
      
      // Simplified deduplication - only 10 seconds to avoid blocking legitimate transfers
      const prefillKey = `crm-direct-prefill-simple`;
      const lastPrefillTime = localStorage.getItem(prefillKey);
      const currentTime = Date.now();
      const tenSeconds = 10 * 1000; // 10 seconds
      
      if (lastPrefillTime && (currentTime - parseInt(lastPrefillTime)) < tenSeconds) {
        console.log('🚫 [DEBUG] Direct prefill blocked - too recent (within 10 seconds)');
        return;
      }
      
      console.log('✅ [DEBUG] Starting direct prefill with data:', prefillData);
      
      // Clean URL immediately to avoid re-processing
      const url = new URL(window.location.href);
      url.searchParams.delete('prefillData');
      const qs = url.searchParams.toString();
      window.history.replaceState({}, '', url.pathname + (qs ? `?${qs}` : ''));
      console.log('🧹 [DEBUG] Cleaned URL');
      
      // Set campaign name and subject
      if (prefillData.title) {
        console.log('📝 [DEBUG] Setting campaign name:', prefillData.title);
        setCampaignName(prefillData.title);
        setSubjectLine(prefillData.title);
      }
      
      // Create blocks from prefilled content
      const newBlocks: ContentBlock[] = [];
      
      // Add header block
      const headerBlock = {
        id: `header-${Date.now()}`,
        type: 'header' as const,
        title: prefillData.title || 'Newsletter',
        headline: prefillData.title || 'Newsletter',
        fontSize: 'text-3xl',
        textAlign: 'center' as const,
        backgroundColor: '#ffffff',
        textColor: '#1a202c',
        source: 'manual' as const
      };
      newBlocks.push(headerBlock);
      console.log('📋 [DEBUG] Added header block:', headerBlock);
      
      // Add main content block
      if (prefillData.content) {
        const contentBlock = {
          id: `content-${Date.now()}`,
          type: 'image-text' as const,
          layout: 'image-right' as const,
          headline: 'Newsletter Content',
          body: prefillData.content,
          imageUrl: prefillData.featuredImage || '',
          altText: 'Newsletter featured image',
          source: 'manual' as const
        };
        newBlocks.push(contentBlock);
        console.log('📋 [DEBUG] Added content block:', contentBlock);
      }
      
      // Set preheader
      const preheader = generatePreheaderText(prefillData.content || '', prefillData.title || 'Newsletter');
      setPreheaderText(preheader);
      console.log('📋 [DEBUG] Set preheader:', preheader);
      
      // Apply blocks
      const normalizedBlocks = normalizeBlocks(autoFillHeaderTitle(newBlocks, prefillData.title || ''));
      console.log('📋 [DEBUG] Setting blocks:', normalizedBlocks);
      setBlocks(normalizedBlocks);
      
      // Store timestamp to prevent re-processing
      localStorage.setItem(prefillKey, currentTime.toString());
      
      toast({
        title: 'Newsletter content loaded',
        description: `Successfully prefilled content from newsletter: "${prefillData.title}"`
      });
      
      console.log('✅ [DEBUG] Prefill completed successfully');
      
    } catch (error) {
      console.error('❌ [DEBUG] Failed to process direct prefill data:', error);
      toast({
        title: 'Prefill failed',
        description: 'Could not load newsletter content. Please try again.',
        variant: 'destructive'
      });
    }
  }, [searchParams]);

  // Prefill from Generated Bundle (newsletter) - HIGH PRIORITY
  useEffect(() => {
    const type = searchParams.get('type');
    if (type !== 'newsletter') return;
    
    // Skip if template-picker flow is active
    if (searchParams.get('flow') === 'template-picker') return;
    
    if (!bundleIdParam) return;
    if (bundleQuery.isLoading || !bundleQuery.data) return;

    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('bundleId');
      const qs = url.searchParams.toString();
      window.history.replaceState({}, '', url.pathname + (qs ? `?${qs}` : ''));
    };

    // Simplified guard: allow refilling if it's been more than 5 minutes since last prefill
    const prefillKey = `crm-prefill:${bundleIdParam}-v3`;
    const lastPrefillTime = localStorage.getItem(prefillKey);
    const currentTime = Date.now();
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    if (lastPrefillTime && (currentTime - parseInt(lastPrefillTime)) < fiveMinutes) {
      console.log('🚫 Prefill blocked - too recent. Last prefill:', new Date(parseInt(lastPrefillTime)));
      cleanUrl();
      return;
    }

    console.log('✅ Starting newsletter prefill from bundle:', bundleIdParam);

    try {
      const items = (bundleQuery.data.content?.items || []) as any[];
      const newsletterItem = items.find((i: any) => i.channel === 'newsletter') || items.find((i: any) => i.channel === 'blog') || items[0];
      if (!newsletterItem) {
        console.log('⚠️ No newsletter item found in bundle data');
        return;
      }
      
      const title = newsletterItem.title || 'Newsletter';
      const body = newsletterItem.body || '';
      
      console.log('📝 Setting campaign data:', { title, bodyLength: body.length });
      
      setCampaignName(title);
      setSubjectLine(title);
      setPreheaderText(generatePreheaderText(body, title));

      // Use robust converter to build 4–5 blocks preview from YAML/Markdown
      const result = convertNewsletterToCRM(body, title);
      const normalizedBlocks = normalizeBlocks(result.blocks);
      
      console.log('🔧 Generated blocks:', normalizedBlocks.length, 'blocks');
      setBlocks(normalizedBlocks);

      // Store current timestamp instead of 'done'
      localStorage.setItem(prefillKey, currentTime.toString());
      
      toast({ 
        title: 'Newsletter content loaded', 
        description: `Prefilled ${normalizedBlocks.length} content blocks from your newsletter.` 
      });
      
      cleanUrl();
    } catch (e) {
      console.error('❌ CRM prefill from bundle failed:', e);
      toast({
        title: 'Prefill failed',
        description: 'Could not load newsletter content. Please try again.',
        variant: 'destructive'
      });
    }
  }, [bundleIdParam, bundleQuery.data, bundleQuery.isLoading, searchParams, toast]);

  // Fallback: Prefill from contentTaskId when no bundleId is available
  useEffect(() => {
    const type = searchParams.get('type');
    if (type !== 'newsletter') return;
    
    // Skip if template-picker flow is active
    if (searchParams.get('flow') === 'template-picker') return;
    
    if (bundleIdParam) return; // Skip if bundleId is available (higher priority)
    if (!finalContentTaskId) return;

    const prefillFromContentTask = async () => {
      console.log('🔄 Attempting prefill from contentTaskId:', finalContentTaskId);
      
      try {
        // Fetch the content task data
        const { data: taskData, error } = await supabase
          .from('content_tasks')
          .select('*')
          .eq('id', finalContentTaskId)
          .single();

        if (error) {
          console.error('❌ Failed to fetch content task:', error);
          return;
        }

        if (!taskData) {
          console.log('⚠️ No content task found with ID:', finalContentTaskId);
          return;
        }

        console.log('📄 Found content task:', {
          id: taskData.id,
          postType: taskData.post_type,
          hasContent: !!taskData.ai_output,
          contentLength: taskData.ai_output?.length || 0
        });

        const title = `${taskData.post_type || 'Newsletter'} Campaign - ${new Date().toLocaleDateString()}`;
        const content = taskData.ai_output || '';

        if (!content) {
          console.log('⚠️ Content task has no generated content');
          return;
        }

        // Set campaign data from content task
        setCampaignName(title);
        setSubjectLine(title);
        setPreheaderText(generatePreheaderText(content, title));

        // Convert content to CRM blocks
        const result = convertNewsletterToCRM(content, title);
        const normalizedBlocks = normalizeBlocks(result.blocks);
        
        console.log('🔧 Generated blocks from content task:', normalizedBlocks.length, 'blocks');
        setBlocks(normalizedBlocks);

        toast({ 
          title: 'Newsletter content loaded', 
          description: `Prefilled ${normalizedBlocks.length} content blocks from newsletter task.` 
        });

      } catch (error) {
        console.error('❌ Failed to prefill from content task:', error);
        toast({
          title: 'Prefill failed',
          description: 'Could not load newsletter content from task. Please try again.',
          variant: 'destructive'
        });
      }
    };

    // Add a small delay to avoid conflicts with other initialization logic
    const timer = setTimeout(prefillFromContentTask, 500);
    return () => clearTimeout(timer);
    
  }, [finalContentTaskId, bundleIdParam, searchParams, toast]);

  // Guard flags to prevent multiple processing runs
  const processedTemplateRef = useRef<string | null>(null);
  const processedExistingCampaignRef = useRef<string | null>(null);
  const processedContentTaskRef = useRef<string | null>(null);

  // Check for existing campaign and load session data
  useEffect(() => {
    const checkExistingCampaign = async () => {
      console.log('🔍 CRMCampaignCreator: Starting campaign check', { campaignSlug, finalContentTaskId });
      
      // Check if this is a truly fresh campaign start (no content loading params)
      const hasTemplateId = searchParams.get('templateId');
      const hasBundleId = searchParams.get('bundleId');
      const hasPrefillData = searchParams.get('prefillData');
      const hasTemplatePickerFlow = searchParams.get('flow') === 'template-picker';
      const isFreshStart = campaignSlug === 'new' && !hasTemplateId && !hasBundleId && !hasPrefillData && !finalContentTaskId && !hasTemplatePickerFlow;
      
      if (isFreshStart) {
        console.log('🆕 Fresh campaign start detected - clearing persisted state and starting blank');
        // CRITICAL FIX: Clear any persisted state to prevent cross-contamination
        clearPersistedState();
        // Reset all state to defaults
        setBlocks([]);
        setCampaignName('');
        setSubjectLine('');
        setPreheaderText('');
        setSelectedPersonas([]);
        setSelectedSegments([]);
        return; // Exit early - don't restore anything
      }
      
      // Try to restore from persisted state (for tab switches, etc.)
      const restoredData = restoreState();
      if (restoredData && !existingCampaignId) {
        const persistedState = restoredData.state;
        console.log('📋 Restoring persisted state - but preserving URL personas');
        setCampaignName(persistedState.campaignName);
        setSubjectLine(persistedState.subjectLine);
        setPreheaderText(persistedState.preheaderText);
        setBlocks(persistedState.blocks);
        setShowPreview(persistedState.showPreview);
        
        // Restore flow parameter if persisted
        if (persistedState.flow && !searchParams.get('flow')) {
          console.log('📋 Restoring flow parameter:', persistedState.flow);
          const url = new URL(window.location.href);
          url.searchParams.set('flow', persistedState.flow);
          window.history.replaceState({}, '', url.toString());
        }
        
        // Only restore personas if no URL persona parameter exists
        if (persistedState.selectedPersonas && initialPersonas.length === 0) {
          console.log('📋 Restoring persisted personas (no URL override):', persistedState.selectedPersonas);
          setSelectedPersonas(persistedState.selectedPersonas);
        } else if (initialPersonas.length > 0) {
          console.log('🎯 Keeping URL personas, ignoring persisted personas. URL:', initialPersonas, 'Persisted:', persistedState.selectedPersonas);
        } else {
          console.log('📋 No personas in URL or persistence');
        }
        
        if (persistedState.selectedSegments) {
          setSelectedSegments(persistedState.selectedSegments);
        }
        console.log('📋 Restored audience selection:', { 
          personas: persistedState.selectedPersonas?.length || 0,
          segments: persistedState.selectedSegments?.length || 0
        });
      }
      
      // Handle newsletter template processing (from picker)
      const templateId = searchParams.get('templateId');
      const layout = searchParams.get('layout');
      const source = searchParams.get('source');
      
      if (templateId && source === 'picker') {
        // Guard: Only process template once
        const templateKey = `${templateId}-${layout}-${source}`;
        if (processedTemplateRef.current === templateKey) {
          console.log('🚫 Template already processed, skipping:', templateKey);
          return;
        }
        
        console.log('🎨 Processing newsletter template:', { templateId, layout });
        processedTemplateRef.current = templateKey;
        
        try {
          setLoading(true);
          
          // Extract week number from templateId (e.g., "weekly-theme-45" → 45)
          const weekMatch = templateId.match(/weekly-theme-(\d+)/);
          const weekNumber = weekMatch ? parseInt(weekMatch[1]) : null;
          console.log('📅 Extracted week number:', weekNumber);
          
          // Load weekly theme data from master_campaign_templates if week number found
          let weeklyThemeData: any = null;
          if (weekNumber) {
            console.log('🔍 Loading weekly theme data for week', weekNumber);
            const { data: themeData, error: themeError } = await supabase
              .from('master_campaign_templates')
              .select('*')
              .eq('week_number', weekNumber)
              .maybeSingle();
            
            if (!themeError && themeData) {
              weeklyThemeData = themeData;
              console.log('✅ Loaded weekly theme:', themeData.title);
            } else {
              console.warn('⚠️ No theme data found for week', weekNumber, themeError);
            }
          }
          
          // Fetch the newsletter ideas to get the template
          const { data, error } = await supabase.rpc('fn_get_newsletter_ideas');
          
          if (error) throw error;
          
          const ideas = Array.isArray(data) ? data as any[] : [];
          let selectedIdea = ideas.find(idea => idea.id === templateId);
          
          // If template not found in ideas but we have weekly theme data, use that
          if (!selectedIdea && weeklyThemeData) {
            console.log('📦 Using weekly theme data as template source');
            selectedIdea = {
              id: templateId,
              title: weeklyThemeData.title,
              description: weeklyThemeData.content_ideas || weeklyThemeData.theme,
              category: 'weekly',
              seasonal_focus: weeklyThemeData.seasonal_focus || weeklyThemeData.theme,
              weekNumber: weekNumber,
              templateBlocks: [
                { 
                  type: 'header', 
                  title: weeklyThemeData.title,
                  body: weeklyThemeData.content_ideas || weeklyThemeData.seasonal_focus || 'Discover what\'s growing this week and get expert tips for your garden.'
                },
                { 
                  type: 'image-text', 
                  content: weeklyThemeData.content_ideas || 'Weekly themed content for your newsletter.' 
                },
                { 
                  type: 'image-text', 
                  title: 'Seasonal Focus', 
                  content: weeklyThemeData.seasonal_focus || `Featured content and ideas for week ${weekNumber}.` 
                }
              ]
            };
          }
          
          if (selectedIdea) {
            console.log('✅ Found template idea:', selectedIdea.title);
            
            // Set campaign details from template
            setCampaignName(selectedIdea.title || 'Newsletter Campaign');
            setSubjectLine(selectedIdea.title || 'Newsletter');
            setPreheaderText(generatePreheaderText(selectedIdea.description || '', selectedIdea.title || ''));
            
            // Generate blocks using the new newsletter block generator
            const templateBlocks = selectedIdea.templateBlocks || [];
            const layoutType = layout as 'block-builder' | 'simple-email' || 'block-builder';
            
            console.log(`🎨 Generating blocks for ${layoutType} layout with ${templateBlocks.length} template blocks`);
            
            let crmBlocks: ContentBlock[];
            try {
              // First, generate basic template blocks
              crmBlocks = generateNewsletterBlocks({
                topic: selectedIdea.title || 'Newsletter Campaign',
                layout: layoutType,
                templateBlocks: templateBlocks
              });
              
              if (crmBlocks.length === 0) {
                console.warn('⚠️ Block generator returned empty array, using fallback');
                crmBlocks = getFallbackBlocks(selectedIdea.title || 'Newsletter Campaign');
              }
              
              // STEP 1: Set loading states for both text and images
              // PHASE 6: Guard against accidental loading flag resets
              console.log('🎨 Setting loading states for content and images...');
              const blocksWithLoadingStates = normalizeBlocks(crmBlocks).map((b) => {
                // Determine if this block should fetch images
                const needsImage = b.type === 'image' || b.type === 'image-text';
                
                // CRITICAL: Template placeholder titles that should be replaced
                const templatePlaceholders = [
                  'Featured Story', 
                  'Main Article', 
                  'Secondary Feature', 
                  'Call to Action',
                  'Content Headline',
                  'Seasonal Spotlight',
                  'Tips & How-To'
                ];
                
                const isTemplatePlaceholder = templatePlaceholders.includes(b.headline || '') || 
                                             templatePlaceholders.includes(b.title || '');
                
                // CRITICAL: Don't mark as loading if content already exists AND it's not a template placeholder
                const hasExistingContent = !isTemplatePlaceholder && 
                  !!(b.headline || b.body) && 
                  b.headline !== '⏳ Generating content...' &&
                  b.headline !== 'Content Headline';
                
                return {
                  ...b,
                  // Only set loading text if no real content exists (template placeholders don't count)
                  headline: (b.type === 'header' || hasExistingContent) ? b.headline : '⏳ Generating content...',
                  body: (b.type === 'header' || hasExistingContent) ? b.body : '',
                  content: (b.type === 'header' || hasExistingContent) ? b.content : '',
                  
                  // Mark blocks that should fetch images
                  shouldFetchImage: needsImage,
                  
                  // Image loading states  
                  imageUrl: needsImage ? 'loading' : b.imageUrl,
                  source: 'template' as const,
                  
                  // CRITICAL: Don't reset loading flag if content already generated
                  isLoadingContent: !hasExistingContent && b.type !== 'header',
                  isLoadingImage: needsImage,
                  
                  // Preserve content generation flags
                  hasGeneratedContent: b.hasGeneratedContent || hasExistingContent
                };
              });
              
              setBlocks(blocksWithLoadingStates);
              
              // STEP 2: Generate AI content for ALL blocks (await completion)
              console.log('🤖 Enhancing template blocks with AI content...');
              
              try {
                const enhancedBlocks = await Promise.all(
                  crmBlocks.map(async (block, index) => {
                    // Skip header blocks from AI enhancement to keep clean titles
                    if (block.type === 'header') {
                      return block;
                    }

                    try {
                      console.log(`🔄 Generating AI content for block ${index + 1}: ${block.type}`);
                      
                      const postType = POST_TYPE_ROTATION[index % POST_TYPE_ROTATION.length];
                      const previousBlocks = crmBlocks.slice(0, index).filter(b => b.type !== 'header' && b.type !== 'divider');
                      
                      const response = await supabase.functions.invoke('generate-email-content', {
                        body: { 
                          prompt: `Create newsletter content for: ${selectedIdea.title}`,
                          type: 'email_block',
                          postType: postType,
                          campaignTitle: selectedIdea.title || 'Newsletter Campaign',
                          campaignContext: selectedIdea.description || '',
                          blockIndex: index,
                          previousBlocks,
                          totalBlocks: crmBlocks.length
                        }
                      });

                      if (response.error) {
                        console.warn(`⚠️ AI generation failed for block ${index + 1}:`, response.error);
                        return block; // Return original block if AI fails
                      }

                      const aiResult = response.data;
                      if (aiResult && aiResult.title && aiResult.content) {
                        console.log(`✅ AI content generated for block ${index + 1}`);
                        
                        // PHASE 2: Apply AI content to block and mark as permanently generated
                        const needsImage = block.type === 'image' || block.type === 'image-text';
                        return {
                          ...block,
                          title: aiResult.title,
                          headline: aiResult.title,
                          content: aiResult.content,
                          body: aiResult.content,
                          ctaText: aiResult.cta_text || block.ctaText,
                          ctaUrl: aiResult.cta_url || block.ctaUrl,
                          shouldFetchImage: needsImage, // Mark if needs image
                          isLoadingContent: false, // Mark content as loaded
                          
                          // NEW: Mark content as permanently generated
                          hasGeneratedContent: true,
                          contentGeneratedAt: Date.now(),
                          contentVersion: (block.contentVersion || 0) + 1
                        };
                      } else {
                        console.warn(`⚠️ AI returned incomplete content for block ${index + 1}`);
                        return { ...block, isLoadingContent: false };
                      }
                    } catch (blockError) {
                      console.warn(`⚠️ Failed to enhance block ${index + 1}:`, blockError);
                      return { ...block, isLoadingContent: false }; // Return original block if enhancement fails
                    }
                  })
                );

                console.log(`✅ Enhanced ${enhancedBlocks.length} blocks with AI content`);
                
                // STEP 3: Update blocks with AI-generated content (images still loading)
                // PHASE 2: Use functional update to preserve content flags
                let contentReadyBlocks: ContentBlock[] = [];
                setBlocks(prevBlocks => {
                  contentReadyBlocks = normalizeBlocks(
                    autoFillHeaderTitle(enhancedBlocks, selectedIdea.title || 'Newsletter Campaign')
                  ).map(b => {
                    const needsImage = b.type === 'image' || b.type === 'image-text';
                    const prev = prevBlocks.find(p => p.id === b.id);
                    return {
                      ...b,
                      shouldFetchImage: needsImage,
                      imageUrl: needsImage ? 'loading' : b.imageUrl,
                      isLoadingImage: needsImage,
                      source: 'template' as const,
                      // Preserve content generation flags from previous state
                      hasGeneratedContent: prev?.hasGeneratedContent || b.hasGeneratedContent,
                      contentGeneratedAt: prev?.contentGeneratedAt || b.contentGeneratedAt,
                      contentVersion: prev?.contentVersion || b.contentVersion
                    };
                  });
                  return contentReadyBlocks;
                });
                crmBlocks = contentReadyBlocks;
                
                // STEP 4: Generate images from AI-generated content
                const weekContext = {
                  title: selectedIdea.title || 'Garden Newsletter',
                  description: selectedIdea.description || '',
                  seasonalFocus: selectedIdea.seasonal_focus || selectedIdea.description || 'seasonal',
                  weekNumber: selectedIdea.weekNumber
                };
                
                // Generate images asynchronously (don't await to avoid blocking UI)
                generateImagesForBlocks(
                  contentReadyBlocks, 
                  weekContext, 
                  usedImageIds, 
                  setUsedImageIds, 
                  setBlocks
                ).catch(err => console.error('❌ Image generation error:', err));
                
              } catch (enhancementError) {
                console.error('❌ Block enhancement failed, using template blocks:', enhancementError);
                // Keep the template blocks as fallback
              }
              
            } catch (error) {
              console.error('❌ Error generating blocks:', error);
              crmBlocks = getFallbackBlocks(selectedIdea.title || 'Newsletter Campaign');
            }
            
            toast({
              title: "Template Applied",
              description: `Newsletter template "${selectedIdea.title}" has been applied successfully with ${crmBlocks.length} blocks for ${layoutType} layout.`,
            });
            
            // Clean up flow parameter after successful processing
            const url = new URL(window.location.href);
            url.searchParams.delete('flow');
            const cleanUrl = url.toString();
            window.history.replaceState({}, '', cleanUrl);
            
            console.log(`✅ [NewsletterInit] Generated ${crmBlocks.length} blocks for "${selectedIdea.title}" (layout: ${layoutType})`);
          } else {
            console.warn('⚠️ Template not found in ideas, checking weekly theme data:', templateId);
            
            // If we have weekly theme data, use that as a backup
            if (weeklyThemeData) {
              console.log('📦 Using weekly theme data from database');
              const topic = weeklyThemeData.title;
              const description = weeklyThemeData.content_ideas || weeklyThemeData.theme;
              
              setCampaignName(topic);
              setSubjectLine(topic);
              setPreheaderText(generatePreheaderText(description, topic));
              
              const layoutType = layout as 'block-builder' | 'simple-email' || 'block-builder';
              console.log(`🎨 Generating ${layoutType} layout blocks for weekly theme: "${topic}"`);
              
              let crmBlocks = generateNewsletterBlocks({
                topic: topic,
                layout: layoutType,
                templateBlocks: []
              });
              
              if (crmBlocks.length === 0) {
                console.warn('⚠️ Block generator returned empty array, using fallback');
                crmBlocks = getFallbackBlocks(topic);
              }
              
              // Set loading states for content and images
              const blocksWithLoadingStates = normalizeBlocks(crmBlocks).map((b) => {
                const needsImage = b.type === 'image' || b.type === 'image-text';
                return {
                  ...b,
                  headline: b.type === 'header' ? b.headline : '⏳ Generating content...',
                  body: b.type === 'header' ? b.body : '',
                  shouldFetchImage: needsImage,
                  imageUrl: needsImage ? 'loading' : b.imageUrl,
                  source: 'template' as const,
                  isLoadingContent: b.type !== 'header',
                  isLoadingImage: needsImage
                };
              });
              
              setBlocks(blocksWithLoadingStates);
              
              // Generate AI content for blocks
              const enhancedBlocks = await Promise.all(
                crmBlocks.map(async (block, index) => {
                  if (block.type === 'header') return block;
                  
                  try {
                    const postType = POST_TYPE_ROTATION[index % POST_TYPE_ROTATION.length];
                    const previousBlocks = crmBlocks.slice(0, index).filter(b => b.type !== 'header' && b.type !== 'divider');
                    
                    const response = await supabase.functions.invoke('generate-email-content', {
                      body: { 
                        prompt: `Create newsletter content for: ${topic}`,
                        type: 'email_block',
                        postType: postType,
                        campaignTitle: topic,
                        campaignContext: description,
                        blockIndex: index,
                        previousBlocks,
                        totalBlocks: crmBlocks.length
                      }
                    });
                    
                    if (response.error || !response.data?.title || !response.data?.content) {
                      console.warn(`⚠️ AI generation failed for block ${index + 1}`);
                      return block;
                    }
                    
                    const aiResult = response.data;
                    const needsImage = block.type === 'image' || block.type === 'image-text';
                    return {
                      ...block,
                      title: aiResult.title,
                      headline: aiResult.title,
                      content: aiResult.content,
                      body: aiResult.content,
                      ctaText: aiResult.cta_text || block.ctaText,
                      ctaUrl: aiResult.cta_url || block.ctaUrl,
                      shouldFetchImage: needsImage,
                      isLoadingContent: false
                    };
                  } catch (blockError) {
                    console.warn(`⚠️ Failed to enhance block ${index + 1}:`, blockError);
                    return { ...block, isLoadingContent: false };
                  }
                })
              );
              
              // Update blocks with AI content
              const contentReadyBlocks = normalizeBlocks(
                autoFillHeaderTitle(enhancedBlocks, topic)
              ).map(b => {
                const needsImage = b.type === 'image' || b.type === 'image-text';
                return {
                  ...b,
                  shouldFetchImage: needsImage,
                  imageUrl: needsImage ? 'loading' : b.imageUrl,
                  isLoadingImage: needsImage,
                  source: 'template' as const
                };
              });
              
              setBlocks(contentReadyBlocks);
              
              // Generate images from AI content
              const weekContext = {
                title: topic,
                description: description,
                seasonalFocus: weeklyThemeData.seasonal_focus || description,
                weekNumber: weekNumber || undefined
              };
              
              generateImagesForBlocks(
                contentReadyBlocks,
                weekContext,
                usedImageIds,
                setUsedImageIds,
                setBlocks
              ).catch(err => console.error('❌ Image generation error:', err));
              
              toast({
                title: "Template Applied",
                description: `Weekly theme "${topic}" has been applied successfully.`,
              });
              
              // Clean up flow parameter
              const url = new URL(window.location.href);
              url.searchParams.delete('flow');
              window.history.replaceState({}, '', url.toString());
              
              setLoading(false);
              return;
            }
            
            // Final fallback: use URL parameters
            console.warn('⚠️ No weekly theme data found, using URL parameters as fallback:', templateId);
            
            const safeDecodeURIComponent = (value: string) => {
              try {
                return decodeURIComponent(value);
              } catch (error) {
                console.warn('Failed to decode URI component:', value, error);
                return value;
              }
            };
            
            const urlTitle = safeDecodeURIComponent(searchParams.get('title') || '');
            const urlDescription = safeDecodeURIComponent(searchParams.get('description') || '');
            
            const topic = urlTitle || weeklyThemeData?.title || 'Newsletter Campaign';
            const description = urlDescription || weeklyThemeData?.content_ideas || topic;
            
            // Generate blocks based on layout and topic
            const layoutType = layout as 'block-builder' | 'simple-email' || 'block-builder';
            const sanitizedTopic = sanitizeCampaignTitle(topic);
            setCampaignName(sanitizedTopic);
            setSubjectLine(sanitizedTopic.replace(' Newsletter', ''));
            setPreheaderText(generatePreheaderText(description, sanitizedTopic));
            
            console.log(`🎨 Generating ${layoutType} layout blocks for topic: "${topic}"`);
            
            let crmBlocks = generateNewsletterBlocks({
              topic: topic,
              layout: layoutType,
              templateBlocks: []
            });
            
            if (crmBlocks.length === 0) {
              console.warn('⚠️ Block generator returned empty array, using fallback');
              crmBlocks = getFallbackBlocks(topic);
            }
            
            // Set loading states for content and images (same as successful path)
            const blocksWithLoadingStates = normalizeBlocks(crmBlocks).map((b) => {
              const needsImage = b.type === 'image' || b.type === 'image-text';
              return {
                ...b,
                headline: b.type === 'header' ? b.headline : '⏳ Generating content...',
                body: b.type === 'header' ? b.body : '',
                shouldFetchImage: needsImage,
                imageUrl: needsImage ? 'loading' : b.imageUrl,
                source: 'template' as const,
                isLoadingContent: b.type !== 'header',
                isLoadingImage: needsImage
              };
            });
            
            setBlocks(blocksWithLoadingStates);
            console.log(`✅ [FallbackInit] Generated ${crmBlocks.length} blocks for "${topic}" (layout: ${layoutType})`);
            
            // TEMPLATE REUSE: Only reuse content when explicitly provided via template_id or source_campaign_id
            // REMOVED: Fuzzy ilike name matching that caused cross-contamination between campaigns
            // Template reuse is now explicit and ID-based, not name-pattern based
            console.log(`🚫 [NoFuzzyLookup] Skipping fuzzy name-based campaign lookup for: "${topic}"`);
            console.log(`📌 Template reuse requires explicit template_id or source_campaign_id params`);
            
            // If a specific templateId was provided via URL params, use it for explicit template lookup
            if (templateIdParam) {
              try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                  // EXPLICIT template lookup - only matches exact template_id
                  const { data: templateCampaign, error } = await supabase
                    .from('crm_campaigns')
                    .select(`
                      id, 
                      name, 
                      subject_line, 
                      preheader, 
                      metadata,
                      campaign_blocks(*)
                    `)
                    .eq('user_id', user.id)
                    .eq('template_id', templateIdParam)
                    .eq('status', 'draft')
                    .limit(1)
                    .maybeSingle();

                  if (!error && templateCampaign && 
                      ((templateCampaign.metadata as any)?.content_blocks?.length > 0 || 
                       templateCampaign.campaign_blocks?.length > 0)) {
                    console.log(`📋 Found existing campaign from template_id=${templateIdParam}: ${templateCampaign.id}`);
                    
                    // Use campaign_blocks if available, otherwise metadata
                    const blocksData = templateCampaign.campaign_blocks?.length > 0 
                      ? templateCampaign.campaign_blocks
                      : (templateCampaign.metadata as any)?.content_blocks || [];
                    
                    // Convert existing blocks back to our format
                    const existingBlocks = blocksData.map((block: any, index: number) => {
                      const blockType = block.block_type || block.type || 'text';
                      const isHeaderBlock = blockType === 'header' || blockType === 'newsletter-header';
                      
                      return {
                        id: block.id || `existing_${Date.now()}_${index}`,
                        type: blockType,
                        title: block.title || '',
                        content: block.content || '',
                        headline: block.headline || block.title || '',
                        body: block.body || (typeof block.content === 'string' ? block.content : ''),
                        ...(isHeaderBlock 
                          ? { backgroundImageUrl: block.image_url || '' }
                          : { imageUrl: block.image_url || '' }
                        ),
                        ctaText: block.cta_text || '',
                        ctaUrl: block.cta_url || '',
                        source: block.source || 'template',
                        personaTag: block.persona_tag || 'general',
                        layout: block.layout || 'full-width',
                        alignment: 'left',
                        textAlign: 'left',
                        padding: 'medium',
                        visible: true,
                        collapsed: false,
                        status: 'ai-generated' as const
                      };
                    });
                    
                    setBlocks(normalizeBlocks(existingBlocks));
                    setExistingCampaignId(templateCampaign.id);
                    setCampaignName(templateCampaign.name);
                    setSubjectLine(templateCampaign.subject_line || topic);
                    setPreheaderText(templateCampaign.preheader || generatePreheaderText(topic, description));
                    
                    console.log(`✅ Loaded template content with ${existingBlocks.length} blocks`);
                    return; // Skip AI generation since we have template content
                  }
                }
              } catch (error) {
                console.warn('Failed to load template campaign:', error);
              }
            }
            
            // Add AI content generation for fallback blocks
            setTimeout(async () => {
              try {
                console.log(`🤖 [FallbackAI] Starting AI enhancement for ${crmBlocks.length} blocks`);
                const enhancedBlocks = [...crmBlocks];
                
                // Mark all content blocks as generating
                const contentBlockIds = enhancedBlocks
                  .filter(block => block.type !== 'header' && block.type !== 'divider')
                  .map(block => block.id);
                setGeneratingBlocks(new Set(contentBlockIds));
                
                for (let i = 0; i < enhancedBlocks.length; i++) {
                  const block = enhancedBlocks[i];
                  
                  if (block.type === 'header' || block.type === 'divider') {
                    continue;
                  }
                  
                  try {
                    const blockPrompt = createBlockPrompt(block, topic, description, i);
                    const payload = {
                      prompt: blockPrompt,
                      type: 'email_block',
                      postType: 'newsletter'
                    };
                    
                    console.log(`🤖 [FallbackAI] Enhancing block ${i + 1}/${enhancedBlocks.length} (${block.type})`);
                    const { data, error } = await supabase.functions.invoke('generate-email-content', { 
                      body: payload 
                    });
                    
                    if (error) {
                      console.warn(`Failed to generate content for fallback block ${i}:`, error);
                      continue;
                    }
                    
                    if (data?.content) {
                      // Use the same AI mapping logic as AIWriterDialog
                      const normalizedAI = normalizeAIResponse(data);
                      const aiEnhancedBlock = applyAIToBlock(block, normalizedAI);
                      
                      enhancedBlocks[i] = aiEnhancedBlock;
                    }
                    
                    // PHASE 2: Update blocks incrementally with functional update
                    setBlocks(prev => {
                      const normalized = normalizeBlocks([...enhancedBlocks]);
                      return normalized.map(block => {
                        const prevBlock = prev.find(p => p.id === block.id);
                        return {
                          ...block,
                          hasGeneratedContent: prevBlock?.hasGeneratedContent || block.hasGeneratedContent,
                          contentGeneratedAt: prevBlock?.contentGeneratedAt || block.contentGeneratedAt,
                          contentVersion: prevBlock?.contentVersion || block.contentVersion
                        };
                      });
                    });
                    
                    // Remove this block from generating set
                    setGeneratingBlocks(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(block.id);
                      return newSet;
                    });
                    
                  } catch (error) {
                    console.error(`Failed to enhance fallback block ${i}:`, error);
                    // Remove from generating set even on error
                    setGeneratingBlocks(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(block.id);
                      return newSet;
                    });
                  }
                }
                
                console.log(`✅ [FallbackAI] AI enhancement complete for "${topic}"`);
                
                // Generate images for blocks with AI content
                const weekContext = {
                  title: topic,
                  description: description,
                  seasonalFocus: weeklyThemeData?.seasonal_focus || description,
                  weekNumber: weekNumber || undefined
                };
                
                console.log('🖼️ [FallbackAI] Starting image generation with context:', weekContext);
                generateImagesForBlocks(
                  enhancedBlocks,
                  weekContext,
                  usedImageIds,
                  setUsedImageIds,
                  setBlocks
                ).catch(err => console.error('❌ [FallbackAI] Image generation error:', err));
                
                // Auto-save the generated content as a draft
                try {
                  console.log('💾 [FallbackAI] Auto-saving generated content as draft');
                  const { data: { user } } = await supabase.auth.getUser();
                  if (user) {
                    const campaignData = {
                      name: topic,
                      subject: subjectLine || topic,
                      preheader: preheaderText || generatePreheaderText(topic, description),
                      sender_name: senderConfig?.displayName || 'BloomSuite',
                      sender_email: senderConfig?.senderEmail || 'noreply@bloomsuite.email',
                      content: '', // HTML will be generated when needed
                      segments: [],
                      schedule: { type: 'immediate' as const },
                      content_blocks: enhancedBlocks
                    };
                    
                    const savedCampaign = await saveCampaignAsDraft(campaignData);
                    setExistingCampaignId(savedCampaign.id);
                    console.log(`✅ [FallbackAI] Content cached in campaign: ${savedCampaign.id}`);
                  }
                } catch (error) {
                  console.warn('Failed to auto-save generated content:', error);
                }
                
              } catch (error) {
                console.error('Failed to enhance fallback blocks with AI:', error);
                // Clear all generating states on major error
                setGeneratingBlocks(new Set());
              }
            }, 500);
          }
        } catch (error) {
          console.error('❌ Error processing template:', error);
          toast({
            title: "Template Error",
            description: "Failed to load the selected template. Starting with a blank campaign.",
            variant: "destructive"
          });
        } finally {
          setLoading(false);
        }
        return;
      }
      
      // Handle direct campaign slug (when editing existing campaign)
      // This takes priority over content task conversion
      if (campaignSlug) {
        // Check if campaignSlug is a valid UUID (existing campaign) or just a slug (new campaign)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const isValidUUID = uuidRegex.test(campaignSlug);
        
        console.log('🔍 CRMCampaignCreator: Checking campaign slug', { campaignSlug, isValidUUID });
        
        if (isValidUUID) {
          // Guard: Only process existing campaign once
          if (processedExistingCampaignRef.current === campaignSlug) {
            console.log('🚫 Existing campaign already processed, skipping:', campaignSlug);
            return;
          }
          
          console.log('🔄 Loading existing campaign by UUID:', campaignSlug);
          processedExistingCampaignRef.current = campaignSlug;
          setLoadingExistingCampaign(true);
          try {
            await loadExistingCampaign(campaignSlug);
            setExistingCampaignId(campaignSlug);
            console.log('✅ Successfully loaded existing campaign');
          } catch (error) {
            console.error('❌ Error loading campaign by UUID:', error);
            toast({
              title: "Error",
              description: "Failed to load campaign data",
              variant: "destructive"
            });
          } finally {
            setLoadingExistingCampaign(false);
          }
          return;
        } else {
          console.log('📝 Campaign slug is not a UUID, treating as new campaign:', campaignSlug);
          // Continue to the content task conversion logic below
        }
      }

      const contentTaskId = finalContentTaskId;
      if (!contentTaskId) return;

      // Guard: Only process content task once
      if (processedContentTaskRef.current === contentTaskId) {
        console.log('🚫 Content task already processed, skipping:', contentTaskId);
        return;
      }
      processedContentTaskRef.current = contentTaskId;

      setLoadingExistingCampaign(true);
      try {
        // Check if content task is already linked to a CRM campaign
        const { data: contentTask, error } = await supabase
          .from('content_tasks')
          .select('linked_crm_campaign_id')
          .eq('id', contentTaskId)
          .single();

        if (error) throw error;

        if (contentTask?.linked_crm_campaign_id) {
          // Load existing CRM campaign data
          await loadExistingCampaign(contentTask.linked_crm_campaign_id);
          setExistingCampaignId(contentTask.linked_crm_campaign_id);
        } else {
          // No existing campaign, proceed with conversion
          const title = searchParams.get('title');
          const content = searchParams.get('content');
          const type = searchParams.get('type');

          if (type === 'newsletter' && !converting && blocks.length === 0) {
            console.log('🔄 Starting newsletter conversion');
            handleNewsletterConversion(contentTaskId, title || '', content || '');
          }
        }
      } catch (error) {
        console.error('Error checking existing campaign:', error);
        // Fall back to normal conversion if check fails
        const title = searchParams.get('title');
        const content = searchParams.get('content');
        const type = searchParams.get('type');

        if (type === 'newsletter' && !converting && blocks.length === 0) {
          console.log('🔄 Starting newsletter conversion (fallback)');
          handleNewsletterConversion(contentTaskId, title || '', content || '');
        }
      } finally {
        setLoadingExistingCampaign(false);
      }
    };

    checkExistingCampaign();
  }, [searchParams.get('templateId'), searchParams.get('layout'), searchParams.get('source'), finalContentTaskId, campaignSlug]);

  // Additional useEffect to monitor blocks changes
  useEffect(() => {
    console.log('📊 Blocks state changed:', { 
      blockCount: blocks.length, 
      blockIds: blocks.map(b => b.id),
      blockTypes: blocks.map(b => b.type)
    });
  }, [blocks]);

  // Initialize blank newsletter with default blocks
  const blankNewsletterInitialized = useRef(false);
  useEffect(() => {
    const isBlankNewsletter = 
      searchParams.get('type') === 'newsletter' &&
      !searchParams.get('templateId') &&
      !searchParams.get('contentTaskId') &&
      !existingCampaignId &&
      !campaignSlug &&
      blocks.length === 0 &&
      !blankNewsletterInitialized.current;

    if (isBlankNewsletter) {
      console.log('🆕 Initializing blank newsletter with default blocks');
      blankNewsletterInitialized.current = true;
      
      setCampaignName('Newsletter Campaign');
      setSubjectLine('Weekly Garden Update');
      setPreheaderText('Essential gardening tips delivered to your inbox');
      
      // Generate default newsletter blocks
      const defaultBlocks = getFallbackBlocks('Newsletter Campaign');
      setBlocks(defaultBlocks);
      
      console.log('✅ Blank newsletter initialized with', defaultBlocks.length, 'blocks');
    }
  }, [
    searchParams.get('type'), 
    searchParams.get('templateId'), 
    searchParams.get('contentTaskId'),
    existingCampaignId,
    campaignSlug,
    blocks.length
  ]);

  const loadExistingCampaign = async (campaignId: string) => {
    try {
      console.log('🔄 Loading existing CRM campaign:', campaignId);
      
      // Load campaign details
      const { data: campaign, error: campaignError } = await supabase
        .from('crm_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      console.log('📊 Campaign query result:', { campaign, campaignError });

      if (campaignError) throw campaignError;

      // Load campaign blocks
      const { data: campaignBlocks, error: blocksError } = await supabase
        .from('campaign_blocks')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('order_index');

      console.log('📊 Blocks query result:', { 
        campaignBlocks: campaignBlocks?.length || 0, 
        blocksError,
        firstBlock: campaignBlocks?.[0] 
      });

      if (blocksError) throw blocksError;

      // Restore campaign state
      setCampaignName(campaign.name);
      setSubjectLine(campaign.subject_line || campaign.name); // Handle missing subject field
      setPreheaderText(campaign.preheader || '');

      console.log('📋 Campaign metadata restored:', {
        name: campaign.name,
        subject: campaign.subject_line,
        preheader: campaign.preheader
      });

        // CANONICAL: Use normalizeBlockFromDatabase for consistent field mapping
        const contentBlocks: ContentBlock[] = (campaignBlocks as DatabaseBlock[]).map(normalizeBlockFromDatabase);

      setBlocks(contentBlocks);

      toast({
        title: "Campaign Loaded",
        description: `Continuing where you left off with ${contentBlocks.length} blocks.`
      });

      console.log('✅ Existing campaign loaded successfully');
    } catch (error) {
      console.error('Error loading existing campaign:', error);
      toast({
        title: "Load Error",
        description: "Failed to load existing campaign. Starting fresh.",
        variant: "destructive"
      });
    }
  };

  const handleNewsletterConversion = async (contentTaskId: string, title: string, urlContent: string) => {
    if (converting) return; // Prevent multiple conversions
    
    setConverting(true);
    
    try {
      console.log('📧 Converting newsletter to CRM campaign', { contentTaskId, title, hasUrlContent: !!urlContent });
      
      let fullContent = urlContent;
      
      // Always try to fetch from database for valid UUID
      if (contentTaskId && contentTaskId.length === 36 && contentTaskId.includes('-')) {
        console.log('🔍 Fetching full content from database for contentTaskId:', contentTaskId);
        try {
          const { data: contentTask, error } = await supabase
            .from('content_tasks')
            .select(`
              ai_output,
              campaigns!inner(title, theme)
            `)
            .eq('id', contentTaskId)
            .single();
          
          if (!error && contentTask?.ai_output) {
            fullContent = contentTask.ai_output;
            
            // Set source content info for verification
            setSourceContentInfo({
              taskId: contentTaskId,
              campaignTitle: contentTask.campaigns?.title || 'Unknown Campaign',
              contentPreview: fullContent.substring(0, 150) + '...'
            });
            
            console.log('✅ Retrieved full content from database:', {
              campaignTitle: contentTask.campaigns?.title,
              contentLength: fullContent.length
            });
          }
        } catch (dbError) {
          console.log('⚠️ Database fetch failed, using URL content:', dbError);
        }
      }
      
      if (!fullContent) {
        throw new Error('No content available for conversion');
      }
      
      console.log('🔄 Converting content (length:', fullContent.length, ')');
      
      // First, try to get preserved newsletter images from the content task
      let preservedImages = {};
      try {
        if (contentTaskId) {
          const { data: attachmentsData } = await supabase
            .from('content_tasks')
            .select('attachments')
            .eq('id', contentTaskId)
            .single();
            
          if (attachmentsData?.attachments && 
              typeof attachmentsData.attachments === 'object' && 
              attachmentsData.attachments !== null &&
              'newsletter_images' in attachmentsData.attachments) {
            const attachments = attachmentsData.attachments as Record<string, any>;
            preservedImages = attachments.newsletter_images;
            console.log('📸 Found preserved newsletter images:', Object.keys(preservedImages));
          }
        }
      } catch (imageError) {
        console.warn('⚠️ Could not fetch preserved images:', imageError);
      }
      
      // Use the enhanced newsletter conversion system with preserved images
      const result = convertNewsletterToCRM(fullContent, title, contentTaskId);
      
      if (!result.blocks || result.blocks.length === 0) {
        throw new Error('Conversion resulted in no blocks');
      }
      
      // Pre-fill campaign settings
      setCampaignName(result.campaignTitle);
      setSubjectLine(result.campaignTitle);
      // Generate content-specific preheader
      const preheaderText = generatePreheaderText(fullContent, result.campaignTitle);
      setPreheaderText(preheaderText);
      
      // Set blocks with layout and images
      const crmBlocks = result.blocks;
      console.log('✅ Newsletter converted to', crmBlocks.length, 'blocks');
      
      setBlocks(normalizeBlocks(crmBlocks));
      
      toast({
        title: "Newsletter Converted!",
        description: `Converted newsletter into ${crmBlocks.length} email blocks.`
      });
      
    } catch (error) {
      console.error('❌ Newsletter conversion failed:', error);
      
      // Create fallback block so user isn't stuck
      const fallbackBlock: ContentBlock = {
        id: 'fallback-block',
        type: 'image-text',
        layout: 'full-width',
        title: 'Newsletter Content',
        content: 'Your newsletter content will appear here. You can edit this block or add new ones below.',
        imageUrl: '',
        shouldFetchImage: true,
        isGeneratingImage: true,
        source: 'manual'
      };
      
      setBlocks([fallbackBlock]);
      setCampaignName(title || 'Newsletter Campaign');
      setSubjectLine('Your Newsletter Update');
      
      toast({
        title: "Conversion Issue",
        description: "Created a basic template. Please edit the content as needed.",
        variant: "destructive"
      });
    } finally {
      setConverting(false);
    }
  };


  const generateEmailHTML = useCallback((): string => {
    // Helper function to get granular fonts with fallback logic
    const getGranularFonts = () => {
      const defaultFont = {
        url: 'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap',
        css: "'Quicksand', sans-serif"
      };

      // Get each font type with fallback to selectedFont, then to Quicksand
      const headlineFont = (companyInfo?.headlineFont?.fontFamilyCss || 
                           companyInfo?.selectedFont?.fontFamilyCss || 
                           defaultFont.css) + ", Arial, sans-serif";
      const subheadingFont = (companyInfo?.subheadingFont?.fontFamilyCss || 
                             companyInfo?.selectedFont?.fontFamilyCss || 
                             defaultFont.css) + ", Arial, sans-serif";
      const bodyFont = (companyInfo?.bodyFont?.fontFamilyCss || 
                       companyInfo?.selectedFont?.fontFamilyCss || 
                       defaultFont.css) + ", Arial, sans-serif";
      const buttonFont = (companyInfo?.buttonFont?.fontFamilyCss || 
                         companyInfo?.selectedFont?.fontFamilyCss || 
                         defaultFont.css) + ", Arial, sans-serif";

      // Collect all unique font URLs for loading
      const fontUrls = [
        companyInfo?.headlineFont?.googleFontsUrl,
        companyInfo?.subheadingFont?.googleFontsUrl,
        companyInfo?.bodyFont?.googleFontsUrl,
        companyInfo?.buttonFont?.googleFontsUrl,
        companyInfo?.selectedFont?.googleFontsUrl
      ].filter((url, index, self) => 
        url && self.indexOf(url) === index // Remove duplicates and nulls
      );

      // If no fonts configured, use default
      if (fontUrls.length === 0) {
        fontUrls.push(defaultFont.url);
      }

      return {
        headlineFont,
        subheadingFont,
        bodyFont,
        buttonFont,
        fontUrls
      };
    };

    const fonts = getGranularFonts();
    const emailContent = generateEmailContentWithStyles(fonts);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subjectLine || 'Email Campaign'}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  ${fonts.fontUrls.map(url => `<link href="${url}" rel="stylesheet">`).join('\n  ')}
  <style>
    ${fonts.fontUrls.map(url => `@import url('${url}');`).join('\n    ')}
    
    /* Typography system with granular fonts */
    h1 { font-family: ${fonts.headlineFont}; }
    h2, h3 { font-family: ${fonts.subheadingFont}; }
    p, td, li, div { font-family: ${fonts.bodyFont}; }
    a.button, .cta-button { font-family: ${fonts.buttonFont}; }
    
    /* Reset and base styles */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    
    /* Mobile responsive styles */
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .content-block {
        padding: 20px 15px !important;
      }
      .mobile-center {
        text-align: center !important;
      }
      .mobile-full-width {
        width: 100% !important;
        display: block !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        padding-bottom: 20px !important;
      }
      .mobile-stack table,
      .mobile-stack tbody,
      .mobile-stack tr,
      .mobile-stack td {
        display: block !important;
        width: 100% !important;
      }
      .mobile-stack td {
        padding-left: 0 !important;
        padding-right: 0 !important;
        padding-bottom: 20px !important;
      }
      .cta-button {
        width: auto !important;
        padding: 12px 24px !important;
        font-size: 16px !important;
      }
      img {
        max-width: 100% !important;
        height: auto !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: ${fonts.bodyFont};">
  ${emailContent}
</body>
</html>`;
  }, [blocks, subjectLine, senderConfig, companyInfo, footerSettings]);

  // Helper function to convert hex color + opacity to RGBA for email compatibility
  const hexToRgba = (hex: string, opacity: number): string => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substr(0, 2), 16);
    const g = parseInt(cleanHex.substr(2, 2), 16);
    const b = parseInt(cleanHex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const generateEmailContentWithStyles = useCallback((fonts: any): string => {
    // Fonts are now passed as parameter from generateEmailHTML
    
    // Helper to check if headline is a default block type label that should not be displayed
    const isBlockTypeLabel = (text: string | undefined): boolean => {
      if (!text) return false;
      const blockTypeLabels = [
        'Full-Width Image',
        'Background Image Section',
        'Background Image',
        'Image Left, Text Right',
        'Image Right, Text Left',
        'Two Column Layout',
        'Newsletter Header',
        'Untitled Block'
      ];
      return blockTypeLabels.includes(text.trim());
    };
    
    // Helper to check if block should hide all text content (headline and body)
    const shouldHideContent = (block: ContentBlock): boolean => {
      const hideContentTitles = [
        'Background Image',
        'Background Image Section',
        'Full-Width Image'
      ];
      return hideContentTitles.includes(block.title?.trim() || '') || 
             hideContentTitles.includes(block.headline?.trim() || '');
    };
    
    let html = `
      <div class="email-container" style="max-width: 600px; margin: 0 auto; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div class="content-block" style="padding: 30px 20px;">
    `;
    
    blocks.forEach(block => {
      if (block.visible === false) return; // Only skip blocks explicitly set to false
      
      // DEBUG: Log block data for newsletter-header blocks
      if (block.type === 'newsletter-header' || block.type === 'header') {
        console.log('[EMAIL-HTML] Rendering header block:', {
          id: block.id,
          type: block.type,
          title: block.title,
          headline: block.headline,
          subtitle: block.subtitle,
          body: block.body,
          publishDate: block.publishDate,
          backgroundImageUrl: block.backgroundImageUrl,
          hasBackgroundImage: !!block.backgroundImageUrl,
          imageUrl: block.imageUrl
        });
      }
      
      // CANONICAL: Use both headline and title as fallbacks for text display
      const blockHeadline = block.headline || block.title || '';
      const blockBody = block.body || block.content || '';
      
      switch (block.type) {
        case 'header':
          const headerAlign = block.textAlign || 'center';
          // Normalize opacity: if > 1, assume it's a percentage (0-100) and convert to decimal (0-1)
          const rawHeaderOpacity = block.backgroundOpacity ?? 40;
          const headerOpacity = rawHeaderOpacity > 1 ? rawHeaderOpacity / 100 : rawHeaderOpacity;
          const headerBgColor = block.backgroundColor || '#1f2937';
          // Use campaign name as fallback headline for header blocks
          const headerHeadline = blockHeadline || campaignName || '';
          
          if (block.backgroundImageUrl) {
            // Table-based layout with background image and RGBA overlay for email compatibility
            // Use nested div structure so overlay sits ON TOP of background image
            const overlayColor = hexToRgba(block.backgroundColor || '#000000', headerOpacity);
            html += `
              <!--[if mso | IE]>
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>
              <![endif]-->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="background-image: url(${block.backgroundImageUrl}); background-size: cover; background-position: center;">
                    <!--[if gte mso 9]>
                    <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;">
                    <v:fill type="frame" src="${block.backgroundImageUrl}" color="${headerBgColor}" />
                    <v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">
                    <![endif]-->
                    <!-- Overlay div sits on top of background image -->
                    <div style="background-color: ${overlayColor}; padding: 40px 20px; text-align: ${headerAlign};">
                      ${!shouldHideContent(block) && headerHeadline && !isBlockTypeLabel(headerHeadline) ? `<h1 style="font-size: 28px; font-weight: 600; margin: 0 0 16px 0; font-family: ${fonts.headlineFont}; color: ${block.textColor || '#ffffff'};">${sanitizeCampaignTitle(headerHeadline)}</h1>` : ''}
                      ${!shouldHideContent(block) && blockBody ? `<div style="font-size: 18px; margin: 0; opacity: 0.9; font-family: ${fonts.bodyFont}; color: ${block.textColor || '#ffffff'};">${blockBody}</div>` : ''}
                    </div>
                    <!--[if gte mso 9]>
                    </v:textbox>
                    </v:rect>
                    <![endif]-->
                  </td>
                </tr>
              </table>
              <!--[if mso | IE]>
              </td></tr></table>
              <![endif]-->
            `;
          } else {
            // Simple solid background
            html += `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="background-color: ${headerBgColor}; padding: 40px 20px; text-align: ${headerAlign};">
                    ${!shouldHideContent(block) && headerHeadline && !isBlockTypeLabel(headerHeadline) ? `<h1 style="font-size: 28px; font-weight: 600; margin: 0 0 16px 0; font-family: ${fonts.headlineFont}; color: ${block.textColor || '#ffffff'};">${headerHeadline}</h1>` : ''}
                    ${!shouldHideContent(block) && blockBody ? `<div style="font-size: 18px; margin: 0; opacity: 0.9; font-family: ${fonts.bodyFont}; color: ${block.textColor || '#ffffff'};">${blockBody}</div>` : ''}
                  </td>
                </tr>
              </table>
            `;
          }
          break;


        case 'image':
          // Check if this is a two-column layout - if so, render like image-text
          const isImageTwoColumnLayout = block.layout === 'two-column-left' || block.layout === 'two-column-right';
          
          if (isImageTwoColumnLayout) {
            // Render as two-column layout (same logic as image-text)
            const isImgLeft = block.layout === 'two-column-left';
            const imgTcTextAlign = block.textAlign || 'left';
            const imgTcTextColor = companyInfo?.brandTextColor || '#475569';
            const imgTcHeadlineColor = companyInfo?.brandTextColor || '#1f2937';
            const imgTcButtonColor = block.buttonColor || companyInfo?.brandPrimaryColor || '#22c55e';
            const imgTcCtaText = block.ctaText || block.buttonText;
            const imgTcCtaUrl = block.ctaUrl || block.buttonUrl;
            
            // If no image, render as text-only block
            if (!block.imageUrl) {
              html += `
                <div style="margin: 20px 0; padding: 20px; ${block.backgroundColor ? `background-color: ${block.backgroundColor};` : ''} border-radius: 8px; text-align: ${imgTcTextAlign};">
                  ${blockHeadline && !isBlockTypeLabel(blockHeadline) ? `<h2 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: ${imgTcHeadlineColor}; font-family: ${fonts.subheadingFont};">${blockHeadline}</h2>` : ''}
                  ${blockBody ? `<div style="color: ${imgTcTextColor}; line-height: 1.6; margin: 0; font-family: ${fonts.bodyFont};">${blockBody}</div>` : ''}
                  ${imgTcCtaText && imgTcCtaUrl ? `
                    <div style="margin-top: 20px;">
                      <a href="${imgTcCtaUrl}" style="display: inline-block; padding: 12px 24px; background: ${imgTcButtonColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: ${fonts.buttonFont};">
                        ${imgTcCtaText}
                      </a>
                    </div>
                  ` : ''}
                </div>
              `;
            } else {
              // Build image cell HTML
              let imgTcImageHtml = `<img src="${block.imageUrl}" alt="${block.altText || ''}" style="width: 100%; height: auto; border-radius: 8px; display: block;" />`;
              
              // Build text content HTML
              let imgTcCleanBody = blockBody || '';
              imgTcCleanBody = imgTcCleanBody.replace(/color:\s*#[0-9a-fA-F]{3,6};?/gi, '');
              imgTcCleanBody = imgTcCleanBody.replace(/color:\s*rgb\([^)]+\);?/gi, '');
              imgTcCleanBody = imgTcCleanBody.replace(/color:\s*rgba\([^)]+\);?/gi, '');
              
              const imgTcTextContentHtml = `
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                  <tr>
                    <td style="padding: 0; vertical-align: top;">
                      ${blockHeadline && !isBlockTypeLabel(blockHeadline) ? `
                        <h2 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: ${imgTcHeadlineColor} !important; font-family: ${fonts.subheadingFont}; line-height: 1.3; display: block;">
                          ${blockHeadline}
                        </h2>
                      ` : ''}
                      ${imgTcCleanBody ? `
                        <div style="color: ${imgTcTextColor} !important; line-height: 1.6; margin: 0 0 16px 0; font-family: ${fonts.bodyFont}; font-size: 16px; display: block;">
                          ${imgTcCleanBody}
                        </div>
                      ` : ''}
                      ${imgTcCtaText && imgTcCtaUrl ? `
                        <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top: 20px;">
                          <tr>
                            <td style="border-radius: 6px; background: ${imgTcButtonColor};">
                              <a href="${imgTcCtaUrl}" style="display: inline-block; padding: 12px 24px; background: ${imgTcButtonColor}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: ${fonts.buttonFont}; font-size: 16px;">
                                ${imgTcCtaText}
                              </a>
                            </td>
                          </tr>
                        </table>
                      ` : ''}
                    </td>
                  </tr>
                </table>
              `;

              // Render with image and text in two-column layout
              html += `
                <div style="margin: 20px 0; padding: 20px; ${block.backgroundColor ? `background-color: ${block.backgroundColor};` : ''} border-radius: 8px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;" class="mobile-stack">
                    <tr>
                      ${isImgLeft ? `
                        <td width="50%" style="padding-right: 20px; vertical-align: top;" class="mobile-full-width mobile-stack">
                          ${imgTcImageHtml}
                        </td>
                        <td width="50%" style="padding-left: 20px; vertical-align: top; text-align: left;" class="mobile-full-width mobile-stack">
                          ${imgTcTextContentHtml}
                        </td>
                      ` : `
                        <td width="50%" style="padding-right: 20px; vertical-align: top; text-align: left;" class="mobile-full-width mobile-stack">
                          ${imgTcTextContentHtml}
                        </td>
                        <td width="50%" style="padding-left: 20px; vertical-align: top;" class="mobile-full-width mobile-stack">
                          ${imgTcImageHtml}
                        </td>
                      `}
                    </tr>
                  </table>
                </div>
              `;
            }
            break;
          }
          
          // Only render single-column image block if it has an imageUrl
          if (block.imageUrl) {
            console.log('🔍 IMAGE BLOCK DEBUG:', {
              id: block.id,
              title: block.title,
              headline: block.headline,
              body: block.body,
              content: block.content,
              ctaText: block.ctaText,
              buttonText: block.buttonText,
              overlayOpacity: block.overlayOpacity,
              overlayColor: block.overlayColor
            });
            
            const imgAlign = block.textAlign || 'center';
            // Force dark text colors for visibility
            const imgTextColor = companyInfo?.brandTextColor || '#475569';
            const imgHeadlineColor = companyInfo?.brandTextColor || '#1f2937';
            const imgButtonColor = block.buttonColor || companyInfo?.brandPrimaryColor || '#22c55e';
            const imgCtaText = block.ctaText || block.buttonText;
            const imgCtaUrl = block.ctaUrl || block.buttonUrl;
            
            // Build image with overlay if configured
            let imageHtml = '';
            if (block.overlayOpacity && block.overlayOpacity > 0 && block.overlayColor) {
              const overlayRgba = hexToRgba(block.overlayColor, block.overlayOpacity);
              console.log('🎨 IMAGE BLOCK OVERLAY:', { overlayColor: block.overlayColor, overlayOpacity: block.overlayOpacity, overlayRgba });
              // Use table with background and semi-transparent padding for overlay
              imageHtml = `
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; border-radius: 8px; overflow: hidden;">
                  <tr>
                    <td background="${block.imageUrl}" bgcolor="${block.overlayColor}" style="background-image: url('${block.imageUrl}'); background-size: cover; background-position: center; background-repeat: no-repeat; border-radius: 8px;">
                      <!--[if gte mso 9]>
                      <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;">
                      <v:fill type="frame" src="${block.imageUrl}" color="${block.overlayColor}" opacity="${Math.round((block.overlayOpacity || 0) * 65535)}" />
                      <v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">
                      <![endif]-->
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td style="padding: 150px 20px; background-color: ${overlayRgba};">
                            ${block.caption ? `<p style="margin: 0; color: #ffffff; text-align: center; font-family: ${fonts.bodyFont};">${block.caption}</p>` : '&nbsp;'}
                          </td>
                        </tr>
                      </table>
                      <!--[if gte mso 9]>
                      </v:textbox>
                      </v:rect>
                      <![endif]-->
                    </td>
                  </tr>
                </table>
              `;
            } else {
              imageHtml = `<img src="${block.imageUrl}" alt="${block.altText || ''}" style="max-width: 100%; height: auto; border-radius: 8px; display: block;" />`;
            }
            
            html += `
              <div style="text-align: ${imgAlign}; margin: 20px 0; ${block.backgroundColor ? `background-color: ${block.backgroundColor}; padding: 20px; border-radius: 8px;` : ''}">
                ${imageHtml}
                ${!shouldHideContent(block) && blockHeadline && !isBlockTypeLabel(blockHeadline) ? `<h2 style="font-size: 24px; font-weight: 600; margin: 16px 0; color: ${imgHeadlineColor}; font-family: ${fonts.subheadingFont}; text-align: ${imgAlign};">${blockHeadline}</h2>` : ''}
                ${!shouldHideContent(block) && blockBody ? `<div style="color: ${imgTextColor}; line-height: 1.6; margin: 0; font-family: ${fonts.bodyFont}; text-align: ${imgAlign};">${blockBody}</div>` : ''}
                ${imgCtaText && imgCtaUrl ? `
                  <div style="margin-top: 20px;">
                    <a href="${imgCtaUrl}" style="display: inline-block; padding: 12px 24px; background: ${imgButtonColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: ${fonts.buttonFont};">
                      ${imgCtaText}
                    </a>
                  </div>
                ` : ''}
              </div>
            `;
          }
          break;

        case 'image-text':
          const isImageLeft = block.layout === 'image-left' || block.layout === 'two-column-left' || !block.layout;
          const itTextAlign = block.textAlign || 'left';
          // Use brand text color with fallbacks
          const itTextColor = companyInfo?.brandTextColor || '#475569';
          const itHeadlineColor = companyInfo?.brandTextColor || '#1f2937';
          const buttonColor = block.buttonColor || companyInfo?.brandPrimaryColor || '#22c55e';
          const ctaText = block.ctaText || block.buttonText;
          const ctaUrl = block.ctaUrl || block.buttonUrl;
          
          console.log('📝 IMAGE-TEXT BLOCK DATA:', {
            layout: block.layout,
            isImageLeft,
            headline: block.headline,
            body: block.body,
            hasHeadline: !!block.headline,
            hasBody: !!block.body,
            ctaText,
            ctaUrl
          });
          
          // If no image, render as text-only block
          if (!block.imageUrl) {
            html += `
              <div style="margin: 20px 0; padding: 20px; ${block.backgroundColor ? `background-color: ${block.backgroundColor};` : ''} border-radius: 8px; text-align: ${itTextAlign};">
                ${blockHeadline && !isBlockTypeLabel(blockHeadline) ? `<h2 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: ${itHeadlineColor}; font-family: ${fonts.subheadingFont};">${blockHeadline}</h2>` : ''}
                ${blockBody ? `<div style="color: ${itTextColor}; line-height: 1.6; margin: 0; font-family: ${fonts.bodyFont};">${blockBody}</div>` : ''}
                ${ctaText && ctaUrl ? `
                  <div style="margin-top: 20px;">
                    <a href="${ctaUrl}" style="display: inline-block; padding: 12px 24px; background: ${buttonColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: ${fonts.buttonFont};">
                      ${ctaText}
                    </a>
                  </div>
                ` : ''}
              </div>
            `;
          } else {
            // Build image cell HTML with overlay support
            let imageCellHtml = '';
            if (block.overlayOpacity && block.overlayOpacity > 0 && block.overlayColor) {
              const overlayRgba = hexToRgba(block.overlayColor, block.overlayOpacity);
              console.log('🎨 IMAGE-TEXT BLOCK OVERLAY:', { overlayColor: block.overlayColor, overlayOpacity: block.overlayOpacity, overlayRgba });
              // Use table with background and semi-transparent inner content for overlay
              imageCellHtml = `
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; border-radius: 8px; overflow: hidden; height: 100%;">
                  <tr>
                    <td background="${block.imageUrl}" bgcolor="${block.overlayColor}" style="background-image: url('${block.imageUrl}'); background-size: cover; background-position: center; background-repeat: no-repeat; border-radius: 8px; vertical-align: top;">
                      <!--[if gte mso 9]>
                      <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:100%;">
                      <v:fill type="frame" src="${block.imageUrl}" color="${block.overlayColor}" opacity="${Math.round((block.overlayOpacity || 0) * 65535)}" />
                      <v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">
                      <![endif]-->
                      <div style="min-height: 250px; background-color: ${overlayRgba};">&nbsp;</div>
                      <!--[if gte mso 9]>
                      </v:textbox>
                      </v:rect>
                      <![endif]-->
                    </td>
                  </tr>
                </table>
              `;
            } else {
              imageCellHtml = `<img src="${block.imageUrl}" alt="${block.altText || ''}" style="width: 100%; height: auto; border-radius: 8px; display: block;" />`;
            }

            // Build text content HTML with proper table structure for email compatibility
            // Strip any inline color styles from body content and force dark colors
            let cleanBody = blockBody || '';
            // Remove any color styles from the body content
            cleanBody = cleanBody.replace(/color:\s*#[0-9a-fA-F]{3,6};?/gi, '');
            cleanBody = cleanBody.replace(/color:\s*rgb\([^)]+\);?/gi, '');
            cleanBody = cleanBody.replace(/color:\s*rgba\([^)]+\);?/gi, '');
            cleanBody = cleanBody.replace(/color:\s*white;?/gi, '');
            cleanBody = cleanBody.replace(/color:\s*#fff;?/gi, '');
            cleanBody = cleanBody.replace(/color:\s*#ffffff;?/gi, '');
            
            const textContentHtml = `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                <tr>
                  <td style="padding: 0; vertical-align: top;">
                    ${blockHeadline && !isBlockTypeLabel(blockHeadline) ? `
                      <h2 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: ${itHeadlineColor} !important; font-family: ${fonts.subheadingFont}; line-height: 1.3; display: block;">
                        ${blockHeadline}
                      </h2>
                    ` : ''}
                    ${cleanBody ? `
                      <div style="color: ${itTextColor} !important; line-height: 1.6; margin: 0 0 16px 0; font-family: ${fonts.bodyFont}; font-size: 16px; display: block;">
                        ${cleanBody}
                      </div>
                    ` : ''}
                    ${ctaText && ctaUrl ? `
                      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top: 20px;">
                        <tr>
                          <td style="border-radius: 6px; background: ${buttonColor};">
                            <a href="${ctaUrl}" style="display: inline-block; padding: 12px 24px; background: ${buttonColor}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: ${fonts.buttonFont}; font-size: 16px;">
                              ${ctaText}
                            </a>
                          </td>
                        </tr>
                      </table>
                    ` : ''}
                  </td>
                </tr>
              </table>
            `;

            // Render with image and text in two-column layout using mobile-responsive table structure
            html += `
              <div style="margin: 20px 0; padding: 20px; ${block.backgroundColor ? `background-color: ${block.backgroundColor};` : ''} border-radius: 8px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;" class="mobile-stack">
                  <tr>
                    ${isImageLeft ? `
                      <td width="50%" style="padding-right: 20px; vertical-align: top;" class="mobile-full-width mobile-stack">
                        ${imageCellHtml}
                      </td>
                      <td width="50%" style="padding-left: 20px; vertical-align: top; text-align: left;" class="mobile-full-width mobile-stack">
                        ${textContentHtml}
                      </td>
                    ` : `
                      <td width="50%" style="padding-right: 20px; vertical-align: top; text-align: left;" class="mobile-full-width mobile-stack">
                        ${textContentHtml}
                      </td>
                      <td width="50%" style="padding-left: 20px; vertical-align: top;" class="mobile-full-width mobile-stack">
                        ${imageCellHtml}
                      </td>
                    `}
                  </tr>
                </table>
              </div>
            `;
          }
          break;

        case 'button':
          const btnAlign = block.textAlign || 'center';
          html += `
             <div style="text-align: ${btnAlign}; margin: 30px 0;">
               ${blockHeadline ? `<h3 style="color: ${block.textColor || companyInfo?.brandTextColor || '#1f2937'}; margin: 0 0 10px 0; font-size: 20px; font-family: ${fonts.subheadingFont}; font-weight: 600;">${blockHeadline}</h3>` : ''}
               ${blockBody ? `<div style="color: ${companyInfo?.brandTextColor || '#64748b'}; margin: 0 0 20px 0; line-height: 1.6; font-family: ${fonts.bodyFont};">${blockBody}</div>` : ''}
               <a href="${block.buttonUrl || '#'}" style="display: inline-block; padding: 12px 24px; background: ${block.buttonColor || companyInfo?.brandPrimaryColor || '#22c55e'}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: ${fonts.buttonFont};">
                 ${block.buttonText || 'Learn More'}
               </a>
             </div>
          `;
          break;

        case 'divider':
          html += `
            <div style="margin: 30px 0;">
              <hr style="border: none; height: 1px; background: #e2e8f0; margin: 0;" />
            </div>
          `;
          break;

        case 'social-follow':
          html += `
            <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 8px;">
              ${blockHeadline ? `<h3 style="color: ${companyInfo?.brandSecondaryColor || '#1e40af'}; margin: 0 0 10px 0; font-size: 20px;">${blockHeadline}</h3>` : ''}
              ${blockBody ? `<div style="color: ${companyInfo?.brandTextColor || '#64748b'}; margin: 0 0 20px 0;">${blockBody}</div>` : ''}
              <div style="display: inline-block;">
                <a href="#" style="display: inline-block; margin: 0 10px; padding: 8px 16px; background: #1877f2; color: white; text-decoration: none; border-radius: 4px;">Facebook</a>
                <a href="#" style="display: inline-block; margin: 0 10px; padding: 8px 16px; background: #1da1f2; color: white; text-decoration: none; border-radius: 4px;">Twitter</a>
                <a href="#" style="display: inline-block; margin: 0 10px; padding: 8px 16px; background: #e4405f; color: white; text-decoration: none; border-radius: 4px;">Instagram</a>
              </div>
            </div>
          `;
          break;

        case 'newsletter-header':
          const nhTextColor = block.textColor || '#ffffff';
          const nhBackgroundColor = block.backgroundColor || '#1f2937';
          // Normalize opacity: if > 1, assume it's a percentage (0-100) and convert to decimal (0-1)
          const rawNhColorOverlayOpacity = block.colorOverlayOpacity ?? 70;
          const nhColorOverlayOpacity = rawNhColorOverlayOpacity > 1 ? rawNhColorOverlayOpacity / 100 : rawNhColorOverlayOpacity;
          const rawNhDarkOverlayOpacity = block.darkOverlayOpacity ?? 30;
          const nhDarkOverlayOpacity = rawNhDarkOverlayOpacity > 1 ? rawNhDarkOverlayOpacity / 100 : rawNhDarkOverlayOpacity;
          const nhTextAlign = block.textAlign || 'center';
          
          // Use campaign name as fallback headline for newsletter-header blocks
          const nhHeadline = block.title || block.headline || campaignName || '';
          
          // Format publish date if exists
          let formattedDate = '';
          if (block.publishDate) {
            try {
              const date = new Date(block.publishDate);
              formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            } catch (e) {
              formattedDate = block.publishDate;
            }
          }
          
          if (block.backgroundImageUrl) {
            // Table-based layout with nested tables for multiple overlays (color + dark) for email compatibility
            const colorOverlay = hexToRgba(nhBackgroundColor, nhColorOverlayOpacity);
            const darkOverlay = nhDarkOverlayOpacity > 0 ? hexToRgba('#000000', nhDarkOverlayOpacity) : '';
            
            // Combine overlays using linear-gradient for better email client support
            const combinedOverlay = darkOverlay 
              ? `linear-gradient(${darkOverlay}, ${darkOverlay}), linear-gradient(${colorOverlay}, ${colorOverlay})`
              : `linear-gradient(${colorOverlay}, ${colorOverlay})`;
            
            html += `
              <!--[if mso | IE]>
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>
              <![endif]-->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border-radius: 8px; overflow: hidden; min-height: 300px;">
                <tr>
                  <td style="background-image: ${combinedOverlay}, url(${block.backgroundImageUrl}); background-size: cover; background-position: center; padding: 60px 20px; text-align: ${nhTextAlign};">
                    <!--[if gte mso 9]>
                    <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px; height:300px;">
                    <v:fill type="frame" src="${block.backgroundImageUrl}" color="${nhBackgroundColor}" opacity="${nhColorOverlayOpacity * 100}%" />
                    <v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">
                    <![endif]-->
                    <div>
                      ${nhHeadline ? `<h1 style="font-size: 42px; font-weight: 700; margin: 0 0 16px 0; font-family: ${fonts.headlineFont}; color: ${nhTextColor}; line-height: 1.2;">${nhHeadline}</h1>` : ''}
                      ${block.subtitle ? `<p style="font-size: 20px; margin: 0 0 24px 0; font-family: ${fonts.subheadingFont}; color: ${nhTextColor}; line-height: 1.4;">${block.subtitle}</p>` : ''}
                      ${(block.issueNumber || formattedDate) ? `
                        <div style="margin: 16px 0;">
                          ${block.issueNumber ? `<span style="color: ${nhTextColor}; font-size: 16px; font-family: ${fonts.bodyFont}; margin-right: 20px;">Issue #${block.issueNumber}</span>` : ''}
                          ${formattedDate ? `<span style="color: ${nhTextColor}; font-size: 16px; font-family: ${fonts.bodyFont};">${formattedDate}</span>` : ''}
                        </div>
                      ` : ''}
                      ${(block.ctaText || block.buttonText) && (block.ctaUrl || block.buttonUrl) ? `
                        <table cellpadding="0" cellspacing="0" border="0" ${nhTextAlign === 'center' ? 'align="center"' : ''} style="margin-top: 32px;">
                          <tr>
                            <td style="background-color: ${block.buttonColor || companyInfo?.brandPrimaryColor || '#22c55e'}; border-radius: 6px; padding: 14px 32px;">
                              <a href="${block.ctaUrl || block.buttonUrl}" style="display: inline-block; color: white; text-decoration: none; font-weight: 600; font-size: 16px; font-family: ${fonts.buttonFont};">
                                ${block.ctaText || block.buttonText}
                              </a>
                            </td>
                          </tr>
                        </table>
                      ` : ''}
                    </div>
                    <!--[if gte mso 9]>
                    </v:textbox>
                    </v:rect>
                    <![endif]-->
                  </td>
                </tr>
              </table>
              <!--[if mso | IE]>
              </td></tr></table>
              <![endif]-->
            `;
          } else {
            // Simple solid background without image
            html += `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="background-color: ${nhBackgroundColor}; padding: 60px 20px; text-align: ${nhTextAlign}; min-height: 300px;">
                    ${nhHeadline ? `<h1 style="font-size: 42px; font-weight: 700; margin: 0 0 16px 0; font-family: ${fonts.headlineFont}; color: ${nhTextColor}; line-height: 1.2;">${nhHeadline}</h1>` : ''}
                    ${block.subtitle ? `<p style="font-size: 20px; margin: 0 0 24px 0; font-family: ${fonts.subheadingFont}; color: ${nhTextColor}; line-height: 1.4;">${block.subtitle}</p>` : ''}
                    ${(block.issueNumber || formattedDate) ? `
                      <div style="margin: 16px 0;">
                        ${block.issueNumber ? `<span style="color: ${nhTextColor}; font-size: 16px; font-family: ${fonts.bodyFont}; margin-right: 20px;">Issue #${block.issueNumber}</span>` : ''}
                        ${formattedDate ? `<span style="color: ${nhTextColor}; font-size: 16px; font-family: ${fonts.bodyFont};">${formattedDate}</span>` : ''}
                      </div>
                    ` : ''}
                    ${(block.ctaText || block.buttonText) && (block.ctaUrl || block.buttonUrl) ? `
                      <table cellpadding="0" cellspacing="0" border="0" ${nhTextAlign === 'center' ? 'align="center"' : ''} style="margin-top: 32px;">
                        <tr>
                          <td style="background-color: ${block.buttonColor || companyInfo?.brandPrimaryColor || '#22c55e'}; border-radius: 6px; padding: 14px 32px;">
                            <a href="${block.ctaUrl || block.buttonUrl}" style="display: inline-block; color: white; text-decoration: none; font-weight: 600; font-size: 16px; font-family: ${fonts.buttonFont};">
                              ${block.ctaText || block.buttonText}
                            </a>
                          </td>
                        </tr>
                      </table>
                    ` : ''}
                  </td>
                </tr>
              </table>
            `;
          }
          break;

        case 'image-gallery':
          // Check if this is a product gallery (has galleryItems) or image gallery (has galleryImages)
          const galleryItems = (block as any).galleryItems || [];
          const galleryImages = (block as any).galleryImages || [];
          
          if (galleryItems.length > 0) {
            // Product Gallery Mode (2x2 grid with badges)
            const productHeadline = block.headline || block.title || '';
            const productBody = block.body || block.content || '';
            const productCtaText = block.ctaText || block.buttonText || '';
            const productCtaUrl = block.ctaUrl || block.buttonUrl || '';
            const brandColor = '#8B4B5C'; // Dusty rose
            const bgColor = '#FAF9F6'; // Warm cream
            
            // Limit to 4 items for 2x2 grid
            const items = galleryItems.slice(0, 4);
            
            // Build product cards HTML (2 per row for email compatibility)
            let productRowsHtml = '';
            for (let i = 0; i < items.length; i += 2) {
              const item1 = items[i];
              const item2 = items[i + 1];
              
              const buildProductCard = (item: any) => {
                if (!item) return '<td class="product-cell" width="50%" style="padding: 8px;"></td>';
                
                const badgeHtml = item.badgeText ? `
                  <div style="position: absolute; top: 8px; right: 8px; background-color: ${brandColor}; color: #ffffff; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 600;">
                    ${item.badgeText}
                  </div>
                ` : '';
                
                const linkStart = item.url ? `<a href="${item.url}" style="text-decoration: none; color: inherit;">` : '';
                const linkEnd = item.url ? '</a>' : '';
                
                return `
                  <td class="product-cell" width="50%" style="padding: 8px; vertical-align: top;">
                    ${linkStart}
                    <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                      <div style="position: relative;">
                        ${item.imageUrl ? `
                          <img src="${item.imageUrl}" alt="${item.title || 'Product'}" style="width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; display: block;" />
                        ` : `
                          <div style="width: 100%; padding-top: 100%; background-color: #f3f4f6;"></div>
                        `}
                        ${badgeHtml}
                      </div>
                      ${item.title ? `
                        <div style="padding: 16px; text-align: center;">
                          <p style="margin: 0; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; color: #374151; font-family: ${fonts.bodyFont};">
                            ${item.title}
                          </p>
                        </div>
                      ` : ''}
                    </div>
                    ${linkEnd}
                  </td>
                `;
              };
              
              productRowsHtml += `
                <tr>
                  ${buildProductCard(item1)}
                  ${buildProductCard(item2)}
                </tr>
              `;
            }
            
            html += `
              <style>
                @media only screen and (max-width: 480px) {
                  .product-cell {
                    width: 100% !important;
                    display: block !important;
                  }
                }
              </style>
              <div style="background-color: ${bgColor}; padding: 32px 16px; margin: 20px 0; border-radius: 8px;">
                <div style="max-width: 600px; margin: 0 auto;">
                  ${productHeadline ? `
                    <h2 style="font-size: 28px; font-weight: 700; text-align: center; margin: 0 0 8px 0; color: ${companyInfo?.brandTextColor || '#1f2937'}; font-family: ${fonts.headlineFont};">
                      ${productHeadline}
                    </h2>
                  ` : ''}
                  ${productBody ? `
                    <p style="font-size: 16px; text-align: center; margin: 0 0 24px 0; color: ${companyInfo?.brandTextColor || '#6b7280'}; font-family: ${fonts.bodyFont};">
                      ${productBody}
                    </p>
                  ` : ''}
                  
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px; margin: 0 auto;">
                    ${productRowsHtml}
                  </table>
                  
                  ${productCtaText && productCtaUrl ? `
                    <div style="text-align: center; margin-top: 32px;">
                      <a href="${productCtaUrl}" style="display: inline-block; padding: 14px 32px; background-color: ${brandColor}; color: #ffffff; text-decoration: none; border-radius: 999px; font-weight: 600; font-size: 16px; font-family: ${fonts.buttonFont};">
                        ${productCtaText}
                      </a>
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          } else if (galleryImages.length > 0) {
            // Standard Image Gallery Mode (3/6/9 images)
            const galleryHeadline = block.headline || block.title || '';
            const galleryBody = block.body || block.content || '';
            const galleryCtaText = block.ctaText || block.buttonText || '';
            const galleryCtaUrl = block.ctaUrl || block.buttonUrl || '';
            
            // Build image grid (3 per row)
            let imageRowsHtml = '';
            for (let i = 0; i < galleryImages.length; i += 3) {
              const row = galleryImages.slice(i, i + 3);
              const cellWidth = Math.floor(100 / 3);
              
              imageRowsHtml += '<tr class="gallery-row">';
              for (let j = 0; j < 3; j++) {
                const img = row[j];
                if (img?.url) {
                  imageRowsHtml += `
                    <td class="gallery-cell" width="${cellWidth}%" style="padding: 4px; vertical-align: top;">
                      <img src="${img.url}" alt="${img.alt || 'Gallery image'}" style="width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 8px; display: block;" />
                    </td>
                  `;
                } else {
                  imageRowsHtml += `<td class="gallery-cell" width="${cellWidth}%" style="padding: 4px;"></td>`;
                }
              }
              imageRowsHtml += '</tr>';
            }
            
            html += `
              <style>
                @media only screen and (max-width: 480px) {
                  .gallery-cell {
                    width: 100% !important;
                    display: block !important;
                    padding: 8px 4px !important;
                  }
                  .gallery-row {
                    display: block !important;
                  }
                }
              </style>
              <div style="padding: 24px 16px; margin: 20px 0;">
                ${galleryHeadline ? `
                  <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 8px 0; color: #1f2937; font-family: ${fonts.headlineFont};">
                    ${galleryHeadline}
                  </h2>
                ` : ''}
                ${galleryBody ? `
                  <p style="font-size: 16px; text-align: center; margin: 0 0 24px 0; color: #6b7280; font-family: ${fonts.bodyFont};">
                    ${galleryBody}
                  </p>
                ` : ''}
                
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto;">
                  ${imageRowsHtml}
                </table>
                
                ${galleryCtaText && galleryCtaUrl ? `
                  <div style="text-align: center; margin-top: 24px;">
                    <a href="${galleryCtaUrl}" style="display: inline-block; padding: 12px 24px; background-color: ${companyInfo?.brandPrimaryColor || '#22c55e'}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: ${fonts.buttonFont};">
                      ${galleryCtaText}
                    </a>
                  </div>
                ` : ''}
              </div>
            `;
          }
          break;

        case 'footer':
          // Footer rendering is handled separately at the end of the function
          // This case is just for the switch statement - actual footer HTML is added below
          break;
      }
    });
    
    // Generate footer with proper token data and settings
    const footerSettings = {
      showPhone: true,
      showLogo: true,
      showManagePreferences: true,
      padding: 'normal' as const,
      alignment: 'center' as const,
      showDivider: true,
      backgroundColor: 'light' as const,
      fontSize: 'sm' as const,
      complianceText: 'You received this email because you subscribed to our newsletter. {{unsubscribe_url}}'
    };
    
    // Use actual company info from the hook instead of hardcoded placeholder
    console.log('🔍 Generating footer with company info:', {
      name: companyInfo?.name,
      address: companyInfo?.address,
      phone: companyInfo?.phone
    });
    const tokenData = getDefaultTokenData(companyInfo);
    // Pass footer background color and full styling from campaign styling overrides
    const footerBgColor = campaignOverrides?.footerStyling?.backgroundColor || campaignOverrides?.footerBackgroundColor;
    const footerStyling = campaignOverrides?.footerStyling;
    const footerHTML = generateFooterHTML(footerSettings, companyInfo, tokenData, footerBgColor, footerStyling);
    console.log('✅ Footer HTML generated with company:', companyInfo?.name, 'footerBgColor:', footerBgColor, 'footerStyling:', footerStyling);
    
    html += `
          ${footerHTML}
        </div>
      </div>
    `;
    
    return html;
  }, [blocks, senderConfig, companyInfo, footerSettings, campaignOverrides]);

  const handleSave = async () => {
    console.log('🚀 Save button clicked');
    console.log('📝 Campaign Name:', `"${campaignName}"`);
    console.log('📝 Subject Line:', `"${subjectLine}"`);
    console.log('📝 Existing Campaign ID:', existingCampaignId);
    
    if (!campaignName.trim() || !subjectLine.trim()) {
      console.log('❌ Validation failed - missing required fields');
      toast({
        title: "Missing Information",
        description: "Please provide both a campaign name and subject line.",
        variant: "destructive"
      });
      return;
    }
    
    console.log('✅ Validation passed - proceeding with save');

    setLoading(true);
    setSaveError(false);
    
    try {
      if (existingCampaignId) {
        // Update existing campaign
        console.log('🔄 Updating existing campaign:', existingCampaignId);
        
        await autoSaveCampaign({
          blocks,
          campaign_name: campaignName,
          subject_line: subjectLine,
          preheader: preheaderText
        });
        
        console.log('✅ Campaign updated successfully');
        
        toast({
          title: "Campaign Updated!",
          description: "Your email campaign has been updated successfully."
        });
        
      } else {
        // Create new campaign
        console.log('➕ Creating new campaign');
        
        // Generate HTML content for the campaign
        const htmlContent = generateEmailHTML();
        
        // Convert blocks to the format expected by the campaign service
        const campaignBlocks = blocks.map((block, index) => ({
          block_type: block.type as 'header' | 'text' | 'image' | 'button' | 'divider',
          content: {
            headline: block.headline,
            body: block.body,
            content: block.content,
            layout: block.layout,
            imageUrl: block.imageUrl,
            altText: block.altText,
            buttonText: block.buttonText,
            buttonUrl: block.buttonUrl,
            buttonColor: block.buttonColor,
            backgroundColor: block.backgroundColor,
            textAlign: block.textAlign,
            fontSize: block.fontSize,
            fontFamily: block.fontFamily
          },
          image_url: block.imageUrl,
          cta_url: block.buttonUrl,
          cta_text: block.buttonText,
          source: block.source || 'manual',
          order_index: index
        }));

        // Prepare campaign data for saving
        const campaignData: CampaignData = {
          name: campaignName,
          subject: subjectLine,
          sender_name: 'Brands in Blooms',
          sender_email: 'hello@brandsinblooms.com',
          content: htmlContent,
          preheader: preheaderText,
          segments: [], // Default empty segments for now
          schedule: {
            type: 'immediate'
          },
          content_blocks: campaignBlocks,
          newsletter_sync: finalContentTaskId ? {
            source_task_id: finalContentTaskId,
            sync_status: 'synced',
            original_blocks_count: blocks.length
          } : undefined
        };

        console.log('💾 Saving new campaign to database:', {
          name: campaignName,
          subject: subjectLine,
          preheader: preheaderText,
          blocks: blocks.length,
          hasSourceContent: !!finalContentTaskId
        });
        
        // Save campaign using the service
        const result = await saveCampaignAsDraft(campaignData);
        
        console.log('✅ Campaign created successfully:', result);
        
        toast({
          title: "Campaign Created!",
          description: "Your email campaign has been saved as a draft."
        });
      }
      
      setLastSaved(new Date());
      
      // Navigate back to campaigns list
      navigate('/crm/campaigns');
      
    } catch (error) {
      console.error('❌ Error saving campaign:', error);
      setSaveError(true);
      
      toast({
        title: "Save Error",
        description: error instanceof Error ? error.message : "Failed to save campaign. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendCampaign = async () => {
    // Validate required fields
    if (!campaignName.trim()) {
      toast({
        title: "Campaign name required",
        description: "Please enter a campaign name before sending.",
        variant: "destructive"
      });
      return;
    }
    
    if (!subjectLine.trim()) {
      toast({
        title: "Subject line required", 
        description: "Please enter a subject line before sending.",
        variant: "destructive"
      });
      return;
    }

    // Check if audience is selected
    // Allow sending to All Contacts when no segments/personas are selected
    // Previously blocked when selectedSegments.length === 0
    // This change enables "All Contacts" default audience
    // (Backend should handle empty segments as all contacts)
    // If you want to force targeting, re-enable this validation.
    // if (selectedSegments.length === 0) {
    //   toast({
    //     title: "Audience required",
    //     description: "Please select customer segments in the Audience section before sending.",
    //     variant: "destructive"
    //   });
    //   return;
    // }

    // Check sender configuration
    if (!senderConfig?.isVerified) {
      setShowSenderConfirmation(true);
      return;
    }

    // Proceed with sending
    await proceedWithSending();
  };

  const proceedWithSending = async () => {
    try {
      setSending(true);
      
      const campaignData: CampaignData = {
        name: campaignName,
        subject: subjectLine,
        sender_name: senderConfig?.displayName || 'Garden Center',
        sender_email: senderConfig?.senderEmail || 'noreply@bloomsuite.email',
        content: generateEmailHTML(),
        preheader: preheaderText,
        segments: selectedSegments,
        schedule: { type: 'immediate' },
        content_blocks: blocks
      };

      // First save as draft, then send immediately
      const campaign = await saveCampaignAsDraft(campaignData);
      
      // Now invoke the edge function to actually send the emails
      console.log('🚀 Invoking send-email-campaign for campaign:', campaign.id);
      const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-email-campaign', {
        body: { campaignId: campaign.id }
      });

      if (sendError) {
        console.error('Send error:', sendError);
        throw new Error(sendError.message || 'Failed to send campaign');
      }

      console.log('✅ Campaign sent successfully:', sendResult);
      
      toast({
        title: "Campaign sent!",
        description: `Your campaign "${campaignName}" has been sent to ${sendResult?.metrics?.sent || 0} customers. View analytics to see delivery progress.`
      });

      // Navigate to campaign analytics instead of campaigns list
      navigate(`/crm/campaigns/${campaign.id}/analytics`);

    } catch (error: any) {
      console.error('Error sending campaign:', error);
      
      let errorMessage = "There was an error sending your campaign. Please try again.";
      if (error.message?.includes('Email service not configured')) {
        errorMessage = "Email service not configured. Please set up your domain or add RESEND_API_KEY.";
      } else if (error.message?.includes('no segment selected')) {
        errorMessage = "Please select an audience segment before sending.";
      } else if (error.message?.includes('No customers found')) {
        errorMessage = "No customers found in the selected segment with valid email addresses.";
      }
      
      toast({
        title: "Send failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  // Memoize email HTML to update when blocks or other dependencies change
  const emailHTMLContent = useMemo(() => {
    return generateEmailHTML();
  }, [generateEmailHTML]);

  if (converting) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Converting newsletter to email campaign...</p>
        </div>
      </div>
    );
  }

  // Check if any blocks are still generating images
  const hasGeneratingImages = blocks.some(b => b.isGeneratingImage);

  return (
    <>
      {/* Sticky Action Bar */}
      <CampaignActionBar
        campaignName={campaignName}
        subjectLine={subjectLine}
        blocks={blocks}
        selectedSegments={selectedSegments}
        senderConfig={senderConfig}
        loadingSenderConfig={loadingSenderConfig}
        lastSaved={lastSaved}
        isAutoSaving={isAutoSaving}
        saveError={saveError}
        sending={sending}
        loading={loading}
        hasGeneratingImages={hasGeneratingImages}
        onSend={handleSendCampaign}
        onSave={handleSave}
        onPreview={() => setShowPreview(true)}
        onAudience={() => setShowSetupWizard(true)}
        onAIWriter={() => setShowAIWriter(true)}
      />

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Breadcrumb Navigation */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/crm">CRM</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/crm/campaigns">Campaigns</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {existingCampaignId ? 'Edit Campaign' : 'New Campaign'}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        
        {/* Back Button & Simple Header */}
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/crm/campaigns')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {existingCampaignId ? 'Edit Email Campaign' : 'Create Email Campaign'}
            </h1>
            <p className="text-muted-foreground">Build and customize your email campaign</p>
          </div>
        </div>

        {/* Campaign Settings - Top Horizontal Section */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="campaign-name">Campaign Name</Label>
                 <Input
                   id="campaign-name"
                   value={campaignName}
                   onChange={(e) => {
                     setCampaignName(e.target.value);
                     // Auto-save campaign settings when they change
                     if (existingCampaignId) {
                       debouncedAutoSave({
                         blocks,
                         campaign_name: e.target.value,
                         subject_line: subjectLine,
                         preheader: preheaderText
                       });
                     }
                   }}
                   placeholder="Enter campaign name"
                   className="mt-1"
                 />
              </div>
              
              <div>
                <Label htmlFor="subject-line">Subject Line</Label>
                 <Input
                   id="subject-line"
                   value={subjectLine}
                   onChange={(e) => {
                     setSubjectLine(e.target.value);
                     // Auto-save campaign settings when they change
                     if (existingCampaignId) {
                       debouncedAutoSave({
                         blocks,
                         campaign_name: campaignName,
                         subject_line: e.target.value,
                         preheader: preheaderText
                       });
                     }
                   }}
                   placeholder="Enter subject line"
                   className="mt-1"
                 />
              </div>
              
              <div>
                <Label htmlFor="preheader">Preheader Text</Label>
                 <Input
                   id="preheader"
                   value={preheaderText}
                   onChange={(e) => {
                     setPreheaderText(e.target.value);
                     // Auto-save campaign settings when they change
                     if (existingCampaignId) {
                       debouncedAutoSave({
                         blocks,
                         campaign_name: campaignName,
                         subject_line: subjectLine,
                         preheader: e.target.value
                       });
                     }
                   }}
                   placeholder="Optional preheader text"
                   className="mt-1"
                 />
              </div>
            </div>
            
            {/* Campaign Readiness Checklist */}
            <CampaignReadiness
              campaignName={campaignName}
              subjectLine={subjectLine}
              blocks={blocks}
              selectedSegments={selectedSegments}
              senderConfig={senderConfig}
              onEditAudience={() => setShowSetupWizard(true)}
            />
          </CardContent>
         </Card>

       {/* Campaign Setup Wizard */}
       <CampaignSetupWizard
         open={showSetupWizard}
         onClose={() => {
           setShowSetupWizard(false);
           // Immediately persist audience data when wizard closes
           persistState({
             campaignName,
             subjectLine,
             preheaderText,
             blocks,
             showPreview,
             selectedPersonas,
             selectedSegments
           });
           console.log('📋 Wizard closed - persisted audience data:', { 
             personas: selectedPersonas.length,
             segments: selectedSegments.length
           });
         }}
         selectedPersonas={selectedPersonas}
         selectedSegments={selectedSegments}
          onPersonasChange={(personas) => {
            console.log('🔄 CampaignSetupWizard: Personas changed:', personas.map(p => ({ id: p.id, name: p.persona_name })));
            setSelectedPersonas(personas);
          }}
         onSegmentsChange={setSelectedSegments}
       />

         {/* Email Content Builder - Full Width */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Email Content</CardTitle>
              {!existingCampaignId && (
                <Button variant="outline" size="sm" onClick={() => setShowAIWriter(true)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Write with AI
                </Button>
              )}
            </div>
          </CardHeader>
        <CardContent>
          <CleanEmailBlockEditor
            blocks={blocks}
            onBlocksChange={(newBlocks) => {
              console.log('[CRM CAMPAIGN CREATOR] Blocks changed:', newBlocks.length);
              
              // Prevent accidental clearing of blocks unless it's intentional
              if (newBlocks.length === 0 && blocks.length > 0) {
                console.log('🚫 [CRM CAMPAIGN CREATOR] Preventing accidental block clearing');
                return;
              }
              
              setBlocks(newBlocks);
              
              // Auto-save when blocks change
              if (existingCampaignId && newBlocks.length > 0) {
                console.log('[CRM CAMPAIGN CREATOR] Triggering auto-save for blocks');
                debouncedAutoSave({
                  blocks: newBlocks,
                  campaign_name: campaignName,
                  subject_line: subjectLine,
                  preheader: preheaderText
                });
              }
            }}
            generatingBlocks={generatingBlocks}
            campaignId={existingCampaignId || undefined}
            campaignName={campaignName}
            onOpenAIImageDialog={(blockId) => {
              setEditingBlockId(blockId);
              setShowAIImageDialog(true);
            }}
            onFooterStylingChange={(styling) => {
              // Update local campaign overrides so email preview reflects changes immediately
              setCampaignOverrides(prev => ({
                ...prev,
                footerStyling: styling,
                footerBackgroundColor: styling.backgroundColor || prev.footerBackgroundColor,
              }));
            }}
          />
        </CardContent>
      </Card>

      {/* Email Preview Modal */}
      <EmailPreview
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        subject={subjectLine}
        content={emailHTMLContent}
      />

      {/* AI Writer Dialog */}
        <AIWriterDialog
          open={showAIWriter}
          onOpenChange={setShowAIWriter}
          onContentGenerated={handleAIContentGenerated}
          onBlockImageGenerated={handleBlockImageGenerated}
          onBlockImageGenerationFailed={handleBlockImageFailed}
        />

      {/* AI Image Personalization Dialog */}
      <AIPersonalizationDialog
        open={showAIImageDialog}
        onOpenChange={setShowAIImageDialog}
        onImageSelect={(imageUrl) => {
          console.log('🖼️ [AIPersonalizationDialog] Image selected:', imageUrl);
          console.log('🖼️ [AIPersonalizationDialog] Editing block ID:', editingBlockId);
          console.log('🖼️ [AIPersonalizationDialog] Current blocks:', blocks.length);
          
          if (editingBlockId) {
            const blockToUpdate = blocks.find(b => b.id === editingBlockId);
            console.log('🖼️ [AIPersonalizationDialog] Block to update:', blockToUpdate);
            
            if (blockToUpdate) {
              // Update the appropriate image field based on block type
              // Clear generation flags to prevent skeleton loader from showing
              const imageUpdate = blockToUpdate.type === 'newsletter-header'
                ? { 
                    backgroundImageUrl: imageUrl, 
                    altText: 'AI Generated Image',
                    isGeneratingImage: false,
                    shouldFetchImage: false,
                    autoImageMode: false // User manually selected, prevent auto-regeneration
                  }
                : { 
                    imageUrl, 
                    altText: 'AI Generated Image',
                    isGeneratingImage: false,
                    shouldFetchImage: false,
                    autoImageMode: false // User manually selected, prevent auto-regeneration
                  };
              
              console.log('🖼️ [AIPersonalizationDialog] Image update:', imageUpdate);
              
              // Create a completely new array with new object references to force React re-render
              const updatedBlocks = blocks.map(b => 
                b.id === editingBlockId 
                  ? { ...b, ...imageUpdate, _updateTimestamp: Date.now() } // Add timestamp to force change detection
                  : b
              );
              
              console.log('🖼️ [AIPersonalizationDialog] Updated blocks:', updatedBlocks.length);
              console.log('🖼️ [AIPersonalizationDialog] Updated block:', updatedBlocks.find(b => b.id === editingBlockId));
              
              setBlocks(updatedBlocks);
              
              // Trigger auto-save to persist the changes
              if (existingCampaignId) {
                console.log('💾 [AIPersonalizationDialog] Triggering auto-save for campaign:', existingCampaignId);
                debouncedAutoSave({
                  blocks: updatedBlocks,
                  campaign_name: campaignName,
                  subject_line: subjectLine,
                  preheader: preheaderText
                });
              }
              
              toast({
                title: 'Image updated!',
                description: 'AI-generated image has been applied to your block.',
              });
            } else {
              console.error('🖼️ [AIPersonalizationDialog] Block not found!');
            }
          } else {
            console.error('🖼️ [AIPersonalizationDialog] No editing block ID!');
          }
          setShowAIImageDialog(false);
          setEditingBlockId(null);
        }}
      />

      {/* Sender Confirmation Modal */}
      <SharedSenderConfirmationModal
        isOpen={showSenderConfirmation}
        onClose={() => setShowSenderConfirmation(false)}
        onConfirm={() => {
          setShowSenderConfirmation(false);
          proceedWithSending();
        }}
        senderConfig={senderConfig}
        campaignName={campaignName}
        recipientCount={selectedPersonas.reduce((total, persona) => total + (persona.customerCount || 0), 0) + selectedSegments.reduce((total, segment) => total + (segment.customerCount || 0), 0)}
      />
      
      {/* 🚨 EMERGENCY MANUAL PREFILL BUTTON */}
      {searchParams.get('type') === 'newsletter' && searchParams.get('prefillData') && (
        <div style={{ position: 'fixed', top: '10px', right: '10px', zIndex: 9999 }}>
          <button
            onClick={() => {
              console.error('🚨🚨🚨 MANUAL BUTTON CLICKED');
              const prefillDataParam = searchParams.get('prefillData');
              if (prefillDataParam) {
                try {
                  const parsedData = JSON.parse(decodeURIComponent(prefillDataParam));
                  console.error('🚨 MANUAL: Successfully parsed data =', parsedData);
                  
                  // Create blocks directly 
                  const newBlocks = [{
                    id: `manual-header-${Date.now()}`,
                    type: 'header' as const,
                    title: parsedData.title || 'Newsletter',
                    headline: parsedData.title || 'Newsletter',
                    source: 'manual' as const
                  }];
                  
                  console.error('🚨 MANUAL: Setting blocks =', newBlocks);
                  setBlocks(newBlocks);
                  setCampaignName(parsedData.title || 'Newsletter');
                  setSubjectLine(parsedData.title || 'Newsletter');
                  
                  toast({
                    title: 'Manual prefill completed',
                    description: 'Newsletter content loaded manually'
                  });
                  
                } catch (error) {
                  console.error('🚨 MANUAL: Error =', error);
                }
              }
            }}
            style={{ 
              background: 'red', 
              color: 'white', 
              padding: '10px', 
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🚨 MANUAL PREFILL
          </button>
        </div>
      )}
      
      </div>
    </>
  );
};
