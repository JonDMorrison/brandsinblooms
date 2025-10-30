
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
import { SenderStatusIndicator } from './campaigns/SenderStatusIndicator';
import { CampaignActionBar } from './CampaignActionBar';
import { CampaignReadiness } from './CampaignReadiness';
import { createBlockPrompt } from '@/utils/blockPromptBuilder';
import { normalizeAIResponse, applyAIToBlock } from '@/lib/newsletter/aiMapping';
import { usePagePersistence } from '@/hooks/usePagePersistence';
import { useSaveQueue } from '@/hooks/useSaveQueue';
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

// Helper function to fetch image for blocks with missing images
const getOrFetchImage = async (contentObj: any, block: any): Promise<string | null> => {
  // CRITICAL: Never fetch images for plain text blocks
  if (block.block_type === 'text' || block.type === 'text') {
    console.log(`📝 Skipping image fetch for plain text block ${block.id}`);
    return null;
  }

  // CRITICAL: Respect the shouldFetchImage flag
  if (contentObj?.shouldFetchImage === false) {
    console.log(`🚫 shouldFetchImage is false for block ${block.id}, skipping image fetch`);
    return null;
  }

  // Check if we already have a valid image URL (from content OR from database column)
  const existingImageUrl = contentObj?.imageUrl || block.image_url;
  if (existingImageUrl && existingImageUrl.trim() !== '') {
    console.log(`✅ Found existing image for block ${block.id}: ${existingImageUrl.substring(0, 50)}...`);
    return existingImageUrl;
  }

  // Generate image based on block content
  const searchQuery = contentObj?.headline || contentObj?.title || contentObj?.body || 'garden plants';
  console.log(`🖼️ Fetching image for block ${block.id} with query: "${searchQuery}"`);
  
  try {
    const imageData = await fetchSmartImage(searchQuery, '', true);
    if (imageData?.url) {
      // Save the image URL back to the database
      const { error } = await supabase
        .from('campaign_blocks')
        .update({ 
          content: {
            ...contentObj,
            imageUrl: imageData.url,
            altText: imageData.alt
          }
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
  
  return blocks.map(block => {
    if (block.type === 'header' && (!block.title || block.title === 'Campaign Title' || block.title === '')) {
      return {
        ...block,
        title: campaignTitle,
        headline: campaignTitle
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

// Normalize blocks to ensure consistency - convert text blocks to image-text blocks with proper structure
const normalizeBlocks = (blocks: ContentBlock[]): ContentBlock[] => {
  return blocks.map(block => {
    // Convert ALL text blocks to image-text blocks for uniformity, not just template/newsletter ones
    if (block.type === 'text') {
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
      
      // Set default headline if still empty
      if (!headline) {
        headline = 'Content Headline';
      }
      
      console.log(`🔄 Normalizing text block ${block.id} to image-text with headline: "${headline}"`);
      
      return {
        ...block,
        type: 'image-text' as const,
        layout: block.layout || 'image-right',
        headline: headline,
        body: block.body || block.content || 'Add your content here'
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
  
  // 🚨 NEWSLETTER PREFILL LOGIC - Read directly from URL params
  const typeParam = searchParams.get('type');
  const prefillDataParam = searchParams.get('prefillData');
  
  console.log('🚨🚨🚨 PREFILL DEBUG: typeParam =', typeParam);
  console.log('🚨🚨🚨 PREFILL DEBUG: prefillDataParam exists =', !!prefillDataParam);
  console.log('🚨🚨🚨 PREFILL DEBUG: prefillDataParam length =', prefillDataParam?.length);
  
  let shouldApplyPrefill = false;
  let prefillData: any = null;
  
  // Check if this is a newsletter with prefill data
  if (typeParam === 'newsletter' && prefillDataParam) {
    console.log('🚨🚨🚨 PREFILL: Found newsletter prefill data in URL params');
    try {
      prefillData = JSON.parse(decodeURIComponent(prefillDataParam));
      shouldApplyPrefill = true;
      console.log('🚨🚨🚨 PREFILL: Successfully parsed data, will apply');
      console.log('🚨 PREFILL DATA:', prefillData);
    } catch (error) {
      console.log('🚨 PREFILL: Parse error =', error);
    }
  } else {
    console.log('🚨🚨🚨 PREFILL: Conditions not met - typeParam:', typeParam, 'prefillDataParam:', !!prefillDataParam);
  }

  const { counts: segmentCounts } = useSegmentCounts();
  
  const [campaignName, setCampaignName] = useState('');
  
  // Page persistence hook
  const { persistState, restoreState } = usePagePersistence<{
    campaignName: string;
    subjectLine: string;
    preheaderText: string;
    blocks: ContentBlock[];
    showPreview: boolean;
    selectedPersonas: any[];
    selectedSegments: any[];
  }>({
    key: `campaign_creator_${campaignSlug || 'new'}`,
    ttl: 2 * 60 * 60 * 1000, // 2 hours for campaign data
    onHidden: () => {
      // Persist critical state when tab is hidden
      persistState({
        campaignName,
        subjectLine,
        preheaderText,
        blocks,
        showPreview,
        selectedPersonas,
        selectedSegments
      });
    }
  });
  
  // Prefill from Generated Bundle if provided
  const bundleIdParam = searchParams.get('bundleId');
  const { query: bundleQuery } = useGeneratedBundle(bundleIdParam || undefined);
  
  // Get contentTaskId from props or URL parameters
  const urlContentTaskId = searchParams.get('contentTaskId');
  const finalContentTaskId = propContentTaskId || urlContentTaskId;
  
  // Check for pre-selected persona from URL
  const personaParam = searchParams.get('persona');
  console.log('🔍 Persona param from URL:', personaParam);
  
  let initialPersonas: any[] = [];
  if (personaParam) {
    try {
      console.log('🔄 Attempting to parse persona parameter...');
      const persona = JSON.parse(decodeURIComponent(personaParam));
      initialPersonas = [persona];
      console.log('🎯 Pre-selected persona from URL:', persona);
      console.log('✅ Initial personas set to:', initialPersonas);
    } catch (error) {
      console.error('❌ Failed to parse persona parameter:', error);
      console.log('🔍 Raw personaParam was:', personaParam);
    }
  } else {
    console.log('🔍 No persona parameter found in URL');
  }
  // Check for pre-selected segment from URL
  const segmentIdParam = searchParams.get('segment'); // Fixed: was 'segmentId', should be 'segment'
  console.log('🔍 Segment ID param from URL:', segmentIdParam);
  
  const [subjectLine, setSubjectLine] = useState('');
  const [preheaderText, setPreheaderText] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  
  // 🚨 APPLY NEWSLETTER PREFILL - Clean implementation after state is ready
  useEffect(() => {
    if (shouldApplyPrefill && prefillData) {
      console.log('🚨🚨🚨 APPLYING PREFILL: Processing newsletter data');
      console.log('🚨 PREFILL DATA:', prefillData);
      
      // Create header block
      const headerBlock: ContentBlock = {
        id: `prefill-header-${Date.now()}`,
        type: 'header' as const,
        title: prefillData.title || 'Newsletter Campaign',
        headline: prefillData.title || 'Newsletter Campaign',
        source: 'manual' as const
      };
      
      // Create content block with image
      const contentBlock: ContentBlock = {
        id: `prefill-content-${Date.now()}`,
        type: 'image-text' as const,
        layout: 'image-right' as const,
        headline: 'Newsletter Content',
        body: prefillData.content || 'Your newsletter content will appear here. This newsletter covers essential topics to help you succeed.',
        imageUrl: prefillData.featuredImage || '',
        altText: 'Newsletter featured image',
        source: 'manual' as const
      };
      
      const newBlocks = [headerBlock, contentBlock];
      
      console.log('🚨 APPLYING PREFILL: Setting blocks =', newBlocks);
      setBlocks(newBlocks);
      
      console.log('🚨 APPLYING PREFILL: Setting campaign name =', prefillData.title);
      setCampaignName(prefillData.title || 'Newsletter Campaign');
      setSubjectLine(prefillData.title || 'Newsletter Campaign');
      
      // Generate preheader
      const preheader = `${prefillData.title || 'Newsletter'} - Expert insights delivered to your inbox`;
      setPreheaderText(preheader);
      
      // Show success toast
      toast({
        title: 'Newsletter content loaded!',
        description: `Successfully loaded: "${prefillData.title}"`
      });
      
      console.log('🚨🚨🚨 PREFILL COMPLETE: Successfully applied all data!');
    }
  }, [shouldApplyPrefill, prefillData, toast]); // Add dependencies to ensure it runs when data is available
  const [selectedPersonas, setSelectedPersonas] = useState<any[]>(() => {
    console.log('🏁 CRMCampaignCreator: Initializing selectedPersonas state with:', initialPersonas);
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
  

  // Sender configuration for domain verification
  const { senderConfig, loading: loadingSenderConfig } = useSenderConfiguration();

  // Footer and company data
  const { footerSettings } = useFooterSettings();
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
              
              const blockData = {
                campaign_id: existingCampaignId,
                block_type: block.type,
                content: {
                  title: block.title || block.headline,
                  content: block.content || block.body,
                  headline: block.headline,
                  body: block.body,
                  alignment: block.alignment,
                  padding: block.padding,
                  margin: block.margin,
                  fontFamily: block.fontFamily,
                  fontSize: block.fontSize,
                  textColor: block.textColor,
                  backgroundColor: block.backgroundColor,
                  backgroundImageUrl: block.backgroundImageUrl,
                  backgroundOpacity: block.backgroundOpacity,
                  overlayColor: (block as any).overlayColor,
                  overlayOpacity: (block as any).overlayOpacity,
                  colorOverlayOpacity: (block as any).colorOverlayOpacity,
                  darkOverlayOpacity: (block as any).darkOverlayOpacity,
                  layout: block.layout,
                  caption: block.caption,
                  altText: block.altText,
                  buttonText: block.buttonText,
                  buttonUrl: block.buttonUrl,
                  ctaStyle: block.ctaStyle,
                  ctaSize: block.ctaSize,
                  quote: block.quote,
                  author: block.author,
                  authorTitle: block.authorTitle,
                  subtitle: block.subtitle,
                  issueNumber: block.issueNumber,
                  publishDate: block.publishDate,
                  visible: block.visible,
                  collapsed: block.collapsed
                },
                image_url: block.imageUrl,
                cta_url: block.ctaUrl || block.buttonUrl,
                cta_text: block.ctaText || block.buttonText,
                source: block.source || 'manual',
                persona_tag: block.personaTag,
                order_index: index
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

  // Handler for AI-generated content
  const handleAIContentGenerated = async (aiData: {
    campaignName: string;
    subjectLine: string;
    preheaderText: string;
    blocks: ContentBlock[];
  }) => {
    console.log('🤖 AI content generated:', aiData);
    
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
      const isFreshStart = campaignSlug === 'new' && !hasTemplateId && !hasBundleId && !hasPrefillData && !finalContentTaskId;
      
      if (isFreshStart) {
        console.log('🆕 Fresh campaign start detected - skipping persistence restoration to start blank');
      } else {
        // First try to restore from persisted state
        const persistedState = restoreState();
        if (persistedState && !existingCampaignId) {
          console.log('📋 Restoring persisted state - but preserving URL personas');
          setCampaignName(persistedState.campaignName);
          setSubjectLine(persistedState.subjectLine);
          setPreheaderText(persistedState.preheaderText);
          setBlocks(persistedState.blocks);
          setShowPreview(persistedState.showPreview);
          
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
          
          // Fetch the newsletter ideas to get the template
          const { data, error } = await supabase.rpc('fn_get_newsletter_ideas');
          
          if (error) throw error;
          
          const ideas = Array.isArray(data) ? data as any[] : [];
          const selectedIdea = ideas.find(idea => idea.id === templateId);
          
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
              console.log('🎨 Setting loading states for content and images...');
              const blocksWithLoadingStates = normalizeBlocks(crmBlocks).map((b) => ({
                ...b,
                // Text loading states
                headline: b.type === 'header' ? b.headline : '⏳ Generating content...',
                body: b.type === 'header' ? b.body : '',
                content: b.type === 'header' ? b.content : '',
                
                // Image loading states  
                imageUrl: (b.type === 'image' || (b as any).shouldFetchImage) ? 'loading' : b.imageUrl,
                source: 'template' as const,
                
                // Track loading state
                isLoadingContent: b.type !== 'header',
                isLoadingImage: (b.type === 'image' || (b as any).shouldFetchImage)
              }));
              
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
                        
                        // Apply AI content to block with proper field mapping
                        return {
                          ...block,
                          title: aiResult.title,
                          headline: aiResult.title,
                          content: aiResult.content,
                          body: aiResult.content,
                          ctaText: aiResult.cta_text || block.ctaText,
                          ctaUrl: aiResult.cta_url || block.ctaUrl,
                          isLoadingContent: false // Mark content as loaded
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
                const contentReadyBlocks = normalizeBlocks(
                  autoFillHeaderTitle(enhancedBlocks, selectedIdea.title || 'Newsletter Campaign')
                ).map(b => ({
                  ...b,
                  imageUrl: (b.type === 'image' || (b as any).shouldFetchImage) ? 'loading' : b.imageUrl,
                  source: 'template' as const
                }));
                
                setBlocks(contentReadyBlocks);
                crmBlocks = contentReadyBlocks;
                
              } catch (enhancementError) {
                console.error('❌ Block enhancement failed, using template blocks:', enhancementError);
                // Keep the template blocks as fallback
              }
              
            } catch (error) {
              console.error('❌ Error generating blocks:', error);
              crmBlocks = getFallbackBlocks(selectedIdea.title || 'Newsletter Campaign');
            }
            
            // STEP 4: Generate images from rich AI-generated content (delay for state propagation)
            setTimeout(async () => {
              console.log('🖼️ Starting image generation from AI-generated content...');
              
              // Use latest React state instead of stale variable
              setBlocks(prev => {
                const latestBlocks = prev;
                
                // Clear loading placeholders and start async generation
                const clearedBlocks = latestBlocks.map(b => ({
                  ...b,
                  imageUrl: b.imageUrl === 'loading' ? '' : b.imageUrl
                }));
                
                // Start async image generation (don't block state update)
                (async () => {
                  try {
                  // Extract rich context from the selected weekly idea
                  const weekContext = {
                    title: selectedIdea.title || 'Garden Newsletter',
                    description: selectedIdea.description || '',
                    seasonalFocus: selectedIdea.seasonal_focus || selectedIdea.description || 'seasonal',
                    contentIdeas: selectedIdea.content_ideas || '',
                    weekNumber: selectedIdea.weekNumber,
                    heroQuery: selectedIdea.heroQuery,
                    category: selectedIdea.category || 'newsletter'
                  };
                  
                  // Find all blocks that need images - use latest React state
                  // CRITICAL: NEVER fetch images for plain text blocks (type: 'text')
                  const imageBlocks = latestBlocks
                    .map((block, index) => ({ block, index }))
                    .filter(({ block }) => {
                      // Exclude plain text blocks entirely
                      if (block.type === 'text') {
                        return false;
                      }
                      
                      // Only fetch images for blocks that are explicitly marked to have images
                      const shouldFetch = (block as any).shouldFetchImage === true;
                      
                      // No need to check for existing images since we cleared them
                      return shouldFetch;
                    })
                    .slice(0, 8);
                  
                  console.log('🖼️ Week Context for Image Generation:', {
                    title: weekContext.title,
                    seasonalFocus: weekContext.seasonalFocus,
                    weekNumber: weekContext.weekNumber,
                    category: weekContext.category,
                    totalBlocks: latestBlocks.length,
                    blocksNeedingImages: imageBlocks.length
                  });
                  
                  console.log(`📸 [Images] Found ${imageBlocks.length} blocks needing images`);
                  
                  // Fetch images using AI-powered keyword generation
                  for (let i = 0; i < imageBlocks.length; i++) {
                    try {
                      const blockInfo = imageBlocks[i];
                      const block = blockInfo.block;
                      
                      // Extract block content for AI keyword generation with fallbacks
                      const blockContent = {
                        headline: block.headline || block.title || weekContext.title || 'Garden Newsletter',
                        body: block.body || block.content || weekContext.description || 'Seasonal garden content',
                        ctaText: block.ctaText || ''
                      };
                      
                      console.log(`🤖 Block ${i + 1}: Generating AI image keywords...`);
                      console.log(`   Headline: "${blockContent.headline}"`);
                      console.log(`   Body: "${blockContent.body?.substring(0, 100)}..."`);
                      
                      // Validate content quality
                      if (!block.headline && !block.body) {
                        console.warn(`⚠️ Block ${i + 1} has no AI content, using week context fallback`);
                      }
                      
                      // STEP 1: Generate AI-powered faceted keywords from rich content
                      const contentPrompt = `${weekContext.title}. ${blockContent.headline} ${blockContent.body}`.trim();
                      
                      console.log(`   📝 Content prompt length: ${contentPrompt.length} chars`);
                      console.log(`   📝 Prompt preview: "${contentPrompt.substring(0, 150)}..."`);

                      
                      const { data: facetsData, error: keywordError } = await supabase.functions.invoke('generate-image-keywords', {
                        body: {
                          prompt: contentPrompt,
                          channel: 'newsletter',
                          useAI: true
                        }
                      });
                      
                      if (keywordError || !facetsData || facetsData.error) {
                        console.warn(`⚠️ AI keyword generation failed for block ${i + 1}:`, keywordError);
                        
                        // Add delay before next request
                        if (i < imageBlocks.length - 1) {
                          await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                        continue;
                      }
                    
                    console.log(`✅ AI Generated Keywords:`, {
                      theme: facetsData.theme,
                      variants: facetsData.variants?.slice(0, 3)
                    });
                    
                    // STEP 2: Fetch images using AI-generated variants
                    const { data: imageData, error: imageError } = await supabase.functions.invoke('fetch-unsplash-images', {
                      body: {
                        query: facetsData.variants[0], // Primary query
                        variants: facetsData.variants,  // All variants to try
                        maxImages: 8,
                        orientation: 'squarish',
                        orderBy: 'relevant',
                        contentFilter: 'high'
                      }
                    });
                    
                    if (imageError || !imageData?.images || imageData.images.length === 0) {
                      console.warn(`⚠️ No images found with AI keywords for block ${i}, skipping image`);
                      
                      // Add delay before next request
                      if (i < imageBlocks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                      }
                      continue;
                    }
                    
                    // STEP 3: Use first garden-validated result
                    const bestMatch = imageData.images[0];
                    console.log(`✅ Selected image: ${bestMatch.id} (${bestMatch.alt?.substring(0, 50)})`);
                    
                    setBlocks(prev => prev.map((b, idx) => 
                      idx === blockInfo.index
                        ? { 
                            ...b, 
                            imageUrl: bestMatch.urls?.regular || bestMatch.download_url,
                            altText: bestMatch.alt || `${weekContext.title} - ${blockContent.headline}` 
                          }
                        : b
                    ));
                    
                    // Add delay between requests to avoid rate limiting
                    if (i < imageBlocks.length - 1) {
                      await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                  } catch (error) {
                    console.error(`❌ Failed to process image for block ${i}:`, error);
                  }
                }
                
                console.log(`📸 [Images] Successfully fetched ${imageBlocks.length} contextual images`);
                
              } catch (error) {
                console.error('Failed to fetch newsletter images:', error);
              }
            })(); // Execute async IIFE
            
            // Return cleared blocks immediately to update UI
            return clearedBlocks;
          });
        }, 200); // Delay for state propagation
            
            toast({
              title: "Template Applied",
              description: `Newsletter template "${selectedIdea.title}" has been applied successfully with ${crmBlocks.length} blocks for ${layoutType} layout.`,
            });
            
            console.log(`✅ [NewsletterInit] Generated ${crmBlocks.length} blocks for "${selectedIdea.title}" (layout: ${layoutType})`);
          } else {
            console.warn('⚠️ Template not found, using URL parameters as fallback:', templateId);
            
            // Extract title and description from URL parameters as fallback
            const safeDecodeURIComponent = (value: string) => {
              try {
                return decodeURIComponent(value);
              } catch (error) {
                console.warn('Failed to decode URI component:', value, error);
                return value; // Return original value if decoding fails
              }
            };
            
            const urlTitle = safeDecodeURIComponent(searchParams.get('title') || '');
            const urlDescription = safeDecodeURIComponent(searchParams.get('description') || '');
            
            const topic = urlTitle || 'Newsletter Campaign';
            const description = urlDescription || topic;
            
            // Generate blocks based on layout and topic
            const layoutType = layout as 'block-builder' | 'simple-email' || 'block-builder';
            setCampaignName(topic);
            setSubjectLine(topic.replace(' Newsletter', ''));
            setPreheaderText(generatePreheaderText(topic, description));
            
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
            
            setBlocks(normalizeBlocks(crmBlocks));
            console.log(`✅ [FallbackInit] Generated ${crmBlocks.length} blocks for "${topic}" (layout: ${layoutType})`);
            
            // Check if we already have cached content for this template
            const cacheKey = `${templateId}-${encodeURIComponent(topic)}-${encodeURIComponent(description)}`;
            console.log(`🔍 Checking for existing content with cache key: ${cacheKey}`);
            
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                // Check for existing campaigns with matching template or title
                const { data: existingCampaign, error } = await supabase
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
                  .eq('status', 'draft')
                  .ilike('name', `%${topic}%`)
                  .limit(1)
                  .maybeSingle();

                if (!error && existingCampaign && 
                    ((existingCampaign.metadata as any)?.content_blocks?.length > 0 || 
                     existingCampaign.campaign_blocks?.length > 0)) {
                  console.log(`📋 Found existing campaign with content: ${existingCampaign.id}`);
                  
                  // Use campaign_blocks if available, otherwise metadata
                  const blocksData = existingCampaign.campaign_blocks?.length > 0 
                    ? existingCampaign.campaign_blocks
                    : (existingCampaign.metadata as any)?.content_blocks || [];
                  
                  // Convert existing blocks back to our format
                  const existingBlocks = blocksData.map((block: any, index: number) => ({
                    id: block.id || `existing_${Date.now()}_${index}`,
                    type: block.block_type || block.type || 'text',
                    title: block.title || '',
                    content: block.content || '',
                    headline: block.headline || block.title || '',
                    body: block.body || (typeof block.content === 'string' ? block.content : ''),
                    imageUrl: block.image_url || '',
                    ctaText: block.cta_text || '',
                    ctaUrl: block.cta_url || '',
                    source: block.source || 'cached',
                    personaTag: block.persona_tag || 'general',
                    layout: block.layout || 'full-width',
                    alignment: 'left',
                    textAlign: 'left',
                    padding: 'medium',
                    visible: true,
                    collapsed: false
                  }));
                  
                  setBlocks(normalizeBlocks(existingBlocks));
                  setExistingCampaignId(existingCampaign.id);
                  setCampaignName(existingCampaign.name);
                  setSubjectLine(existingCampaign.subject_line || topic);
                  setPreheaderText(existingCampaign.preheader || generatePreheaderText(topic, description));
                  
                  console.log(`✅ Loaded cached content with ${existingBlocks.length} blocks`);
                  return; // Skip AI generation since we have cached content
                }
              }
            } catch (error) {
              console.warn('Failed to check for existing content:', error);
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
                    
                    // Update blocks incrementally so user sees progress
                    setBlocks(normalizeBlocks([...enhancedBlocks]));
                    
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

        // Convert campaign blocks back to ContentBlocks using enhanced transformBlock function
        const transformBlock = async (block: any): Promise<ContentBlock> => {
          console.log('🔍 Transforming block:', {
            blockId: block.id,
            blockType: block.block_type,
            rawContent: block.content,
            imageUrl: block.image_url,
            ctaUrl: block.cta_url,
            ctaText: block.cta_text
          });

          // Parse the content if it's a string
          let contentObj = block.content;
          if (typeof block.content === 'string') {
            try {
              contentObj = JSON.parse(block.content);
            } catch (e) {
              console.warn('Failed to parse block content as JSON:', e);
              contentObj = {};
            }
          } else if (!block.content || typeof block.content !== 'object') {
            contentObj = {};
          }

          // CRITICAL FIX: Unwrap nested content structure
          // Database stores content like: { content: { body: "text", content: "text", headline: "..." } }
          // We need to unwrap to get to the actual content fields
          while (contentObj && typeof contentObj === 'object' && contentObj.content && typeof contentObj.content === 'object') {
            console.log('🔧 Unwrapping nested content layer:', Object.keys(contentObj.content));
            contentObj = contentObj.content;
          }
          
          console.log('✅ Content after unwrapping:', {
            blockId: block.id,
            hasBody: !!contentObj?.body,
            hasContent: !!contentObj?.content,
            hasHeadline: !!contentObj?.headline,
            bodyType: typeof contentObj?.body,
            contentType: typeof contentObj?.content
          });

          // Detect if this should actually be a header block
          // Check for header block characteristics: backgroundColor + imageUrl + full-width layout
          let actualBlockType = block.block_type;
          if (block.block_type === 'text' && contentObj?.content) {
            const nestedContent = contentObj.content;
            const hasBackgroundColor = nestedContent?.backgroundColor;
            const hasImageUrl = nestedContent?.imageUrl;
            const isFullWidth = nestedContent?.layout === 'full-width';
            
            if (hasBackgroundColor && hasImageUrl && isFullWidth) {
              console.log('🔄 Converting misclassified text block to header block:', block.id);
              actualBlockType = 'header';
            }
          }

        // Use simplified content structure with validation
        console.log('[HYDRATION] Processing block with clean content structure:', {
          blockId: block.id,
          blockType: block.block_type,
          contentObj: contentObj,
          hasContent: !!contentObj?.content,
          hasBody: !!contentObj?.body,
          hasHeadline: !!contentObj?.headline,
          hasTitle: !!contentObj?.title
        });
        
        // Extract content directly from the simplified structure
        const finalExtractedContent = {
          // Essential content fields - prioritize direct fields
          headline: contentObj?.headline,
          title: contentObj?.title,
          body: contentObj?.body || contentObj?.content,
          content: contentObj?.content || contentObj?.body,
          subtitle: contentObj?.subtitle,
          // Image fields - CRITICAL FIX: Treat empty strings as null and fetch if missing
          imageUrl: await getOrFetchImage(contentObj, block),
          altText: contentObj?.altText,
          caption: contentObj?.caption,
          // Button/CTA fields
          buttonText: contentObj?.buttonText,
          buttonUrl: contentObj?.buttonUrl,
          ctaText: contentObj?.ctaText,
          ctaUrl: contentObj?.ctaUrl,
          ctaStyle: contentObj?.ctaStyle,
          ctaSize: contentObj?.ctaSize,
          // Layout and styling
          layout: contentObj?.layout || 'full-width',
          alignment: contentObj?.alignment,
          padding: contentObj?.padding || 'medium',
          margin: contentObj?.margin,
          // Typography
          fontFamily: contentObj?.fontFamily,
          fontSize: contentObj?.fontSize,
          textColor: contentObj?.textColor,
          textAlign: contentObj?.textAlign || contentObj?.alignment,
          // Background
          backgroundColor: contentObj?.backgroundColor,
          backgroundImageUrl: contentObj?.backgroundImageUrl,
          backgroundOpacity: contentObj?.backgroundOpacity,
          // Overlays
          overlayColor: contentObj?.overlayColor,
          overlayOpacity: contentObj?.overlayOpacity,
          colorOverlayOpacity: contentObj?.colorOverlayOpacity,
          darkOverlayOpacity: contentObj?.darkOverlayOpacity,
          // Special content
          quote: contentObj?.quote,
          author: contentObj?.author,
          authorTitle: contentObj?.authorTitle,
          issueNumber: contentObj?.issueNumber,
          publishDate: contentObj?.publishDate,
          // Meta
          visible: contentObj?.visible !== false,
          collapsed: contentObj?.collapsed || false
        };

        console.log('📋 Content extraction details:', {
          blockId: block.id,
          originalContentObj: contentObj,
          extractedContent: {
            headline: finalExtractedContent.headline,
            title: finalExtractedContent.title,
            body: finalExtractedContent.body,
            imageUrl: finalExtractedContent.imageUrl,
            altText: finalExtractedContent.altText,
            buttonText: finalExtractedContent.buttonText,
            buttonUrl: finalExtractedContent.buttonUrl,
            backgroundColor: finalExtractedContent.backgroundColor,
            layout: finalExtractedContent.layout
          }
        });

        // Build the transformed block with comprehensive field mapping
        const transformedBlock: ContentBlock = {
          id: block.id,
          // Use the detected actualBlockType which includes header block auto-detection
          type: actualBlockType === 'header'
            ? 'header' as ContentBlock['type']
            : (actualBlockType === 'text' && finalExtractedContent.imageUrl && finalExtractedContent.imageUrl !== '/images/newsletter-fallback.jpg')
              ? 'image-text' as ContentBlock['type']
              : actualBlockType as ContentBlock['type'],
          title: finalExtractedContent.title || finalExtractedContent.headline || 'Untitled Block',
          headline: finalExtractedContent.headline || finalExtractedContent.title,
          body: finalExtractedContent.body || finalExtractedContent.content,
          content: finalExtractedContent.body || finalExtractedContent.content || '',
          source: (block.source as ContentBlock['source']) || 'manual',
          // Image fields - map correctly for header vs other blocks
          imageUrl: block.block_type === 'header' ? undefined : (finalExtractedContent.imageUrl || block.image_url),
          altText: finalExtractedContent.altText,
          caption: finalExtractedContent.caption,
          // Button/CTA fields
          buttonText: finalExtractedContent.buttonText || block.cta_text,
          buttonUrl: finalExtractedContent.buttonUrl || block.cta_url,
          ctaText: finalExtractedContent.ctaText || block.cta_text,
          ctaUrl: finalExtractedContent.ctaUrl || block.cta_url,
          ctaStyle: finalExtractedContent.ctaStyle,
          ctaSize: finalExtractedContent.ctaSize,
          // Layout and styling
          visible: finalExtractedContent.visible !== false,
          collapsed: finalExtractedContent.collapsed || false,
          layout: finalExtractedContent.layout || 'full-width',
          alignment: finalExtractedContent.alignment || 'left',
          padding: finalExtractedContent.padding || 'medium',
          margin: finalExtractedContent.margin,
          // Typography
          fontFamily: finalExtractedContent.fontFamily,
          fontSize: finalExtractedContent.fontSize,
          textColor: finalExtractedContent.textColor,
          textAlign: finalExtractedContent.textAlign || finalExtractedContent.alignment,
          // Background
          backgroundColor: finalExtractedContent.backgroundColor,
          backgroundImageUrl: actualBlockType === 'header' ? (finalExtractedContent.backgroundImageUrl || block.image_url) : finalExtractedContent.backgroundImageUrl,
          backgroundOpacity: finalExtractedContent.backgroundOpacity,
          // Overlay settings (per-image)
          overlayColor: finalExtractedContent.overlayColor,
          overlayOpacity: finalExtractedContent.overlayOpacity,
          // Newsletter-specific
          subtitle: finalExtractedContent.subtitle,
          quote: finalExtractedContent.quote,
          author: finalExtractedContent.author,
          authorTitle: finalExtractedContent.authorTitle,
          issueNumber: finalExtractedContent.issueNumber,
          publishDate: finalExtractedContent.publishDate
        };

        // Enhanced logging to verify header block fix
        console.log('🧱 Hydrated contentObj:', {
          blockId: block.id,
          originalType: block.block_type,
          finalType: transformedBlock.type, 
          headline: transformedBlock.headline,
          body: transformedBlock.body,
          imageUrl: transformedBlock.imageUrl,
          backgroundImageUrl: transformedBlock.backgroundImageUrl,
          buttonText: transformedBlock.buttonText,
          buttonUrl: transformedBlock.buttonUrl,
          backgroundColor: transformedBlock.backgroundColor,
          layout: transformedBlock.layout,
          hasImage: !!transformedBlock.imageUrl && transformedBlock.imageUrl !== '/images/newsletter-fallback.jpg',
          isHeaderWithBackground: block.block_type === 'header' && !!transformedBlock.backgroundImageUrl
        });

        return transformedBlock;
      };

      const contentBlocks: ContentBlock[] = await Promise.all(campaignBlocks.map(transformBlock));

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
        type: 'text',
        layout: 'full-width',
        title: 'Newsletter Content',
        content: 'Your newsletter content will appear here. You can edit this block or add new ones below.',
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
        'Newsletter Header'
      ];
      return blockTypeLabels.includes(text.trim());
    };
    
    let html = `
      <div class="email-container" style="max-width: 600px; margin: 0 auto; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div class="content-block" style="padding: 30px 20px;">
    `;
    
    blocks.forEach(block => {
      if (block.visible === false) return; // Only skip blocks explicitly set to false
      
      switch (block.type) {
        case 'header':
          const headerAlign = block.textAlign || 'center';
          const headerOpacity = block.backgroundOpacity || 0.4;
          const headerBgColor = block.backgroundColor || '#1f2937';
          
          if (block.backgroundImageUrl) {
            // Table-based layout with background image and RGBA overlay for email compatibility
            const overlayColor = hexToRgba(block.backgroundColor || '#000000', headerOpacity);
            html += `
              <!--[if mso | IE]>
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>
              <![endif]-->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="background-image: url(${block.backgroundImageUrl}); background-size: cover; background-position: center; padding: 40px 20px; text-align: ${headerAlign}; background-color: ${overlayColor};">
                    <!--[if gte mso 9]>
                    <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;">
                    <v:fill type="frame" src="${block.backgroundImageUrl}" color="${headerBgColor}" />
                    <v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">
                    <![endif]-->
                    <div style="background-color: ${overlayColor}; padding: 0;">
                      ${block.headline && !isBlockTypeLabel(block.headline) ? `<h1 style="font-size: 28px; font-weight: 600; margin: 0 0 16px 0; font-family: ${fonts.headlineFont}; color: ${block.textColor || '#ffffff'};">${block.headline}</h1>` : ''}
                      ${block.body || block.content ? `<div style="font-size: 18px; margin: 0; opacity: 0.9; font-family: ${fonts.bodyFont}; color: ${block.textColor || '#ffffff'};">${block.body || block.content || ''}</div>` : ''}
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
                    ${block.headline && !isBlockTypeLabel(block.headline) ? `<h1 style="font-size: 28px; font-weight: 600; margin: 0 0 16px 0; font-family: ${fonts.headlineFont}; color: ${block.textColor || '#ffffff'};">${block.headline}</h1>` : ''}
                    ${block.body || block.content ? `<div style="font-size: 18px; margin: 0; opacity: 0.9; font-family: ${fonts.bodyFont}; color: ${block.textColor || '#ffffff'};">${block.body || block.content || ''}</div>` : ''}
                  </td>
                </tr>
              </table>
            `;
          }
          break;

        case 'text':
          const textAlign = block.textAlign || 'left';
          const textColor = block.textColor || '#475569';
          const textCtaText = block.ctaText || block.buttonText;
          const textCtaUrl = block.ctaUrl || block.buttonUrl;
          const textButtonColor = block.buttonColor || companyInfo?.brandPrimaryColor || '#22c55e';
          
          html += `
            <div style="margin: 20px 0; text-align: ${textAlign}; font-size: ${block.fontSize || '16px'}; font-family: ${fonts.bodyFont}; ${block.backgroundColor ? `background-color: ${block.backgroundColor}; padding: 20px; border-radius: 8px;` : ''}">
              ${block.headline && !isBlockTypeLabel(block.headline) ? `<h2 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: ${textColor}; font-family: ${fonts.subheadingFont};">${block.headline}</h2>` : ''}
              ${block.content || block.body ? `<div style="color: ${textColor}; line-height: 1.6; font-family: ${fonts.bodyFont};">${block.content || block.body}</div>` : ''}
              ${textCtaText && textCtaUrl ? `
                <div style="margin-top: 20px;">
                  <a href="${textCtaUrl}" style="display: inline-block; padding: 12px 24px; background: ${textButtonColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: ${fonts.buttonFont};">
                    ${textCtaText}
                  </a>
                </div>
              ` : ''}
            </div>
          `;
          break;

        case 'image':
          // Only render image block if it has an imageUrl
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
            const imgTextColor = '#475569'; // Always use dark gray for body text
            const imgHeadlineColor = '#1f2937'; // Always use darker gray for headlines
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
                ${block.headline && !isBlockTypeLabel(block.headline) ? `<h2 style="font-size: 24px; font-weight: 600; margin: 16px 0; color: ${imgHeadlineColor}; font-family: ${fonts.subheadingFont}; text-align: ${imgAlign};">${block.headline}</h2>` : ''}
                ${block.body || block.content ? `<div style="color: ${imgTextColor}; line-height: 1.6; margin: 0; font-family: ${fonts.bodyFont}; text-align: ${imgAlign};">${block.body || block.content}</div>` : ''}
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
          // Force dark text colors for visibility - ignore block.textColor if it's too light
          const itTextColor = '#475569'; // Always use dark gray for body text
          const itHeadlineColor = '#1f2937'; // Always use darker gray for headlines
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
                ${block.headline && !isBlockTypeLabel(block.headline) ? `<h2 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: ${itHeadlineColor}; font-family: ${fonts.subheadingFont};">${block.headline}</h2>` : ''}
                ${block.body ? `<div style="color: ${itTextColor}; line-height: 1.6; margin: 0; font-family: ${fonts.bodyFont};">${block.body}</div>` : ''}
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
            let cleanBody = block.body || '';
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
                    ${block.headline && !isBlockTypeLabel(block.headline) ? `
                      <h2 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: ${itHeadlineColor} !important; font-family: ${fonts.subheadingFont}; line-height: 1.3; display: block;">
                        ${block.headline}
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
               ${block.headline ? `<h3 style="color: ${block.textColor || '#1f2937'}; margin: 0 0 10px 0; font-size: 20px; font-family: ${fonts.subheadingFont}; font-weight: 600;">${block.headline}</h3>` : ''}
               ${block.body ? `<div style="color: #64748b; margin: 0 0 20px 0; line-height: 1.6; font-family: ${fonts.bodyFont};">${block.body}</div>` : ''}
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
              ${block.headline ? `<h3 style="color: #1e40af; margin: 0 0 10px 0; font-size: 20px;">${block.headline}</h3>` : ''}
              ${block.body ? `<div style="color: #64748b; margin: 0 0 20px 0;">${block.body}</div>` : ''}
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
          const nhColorOverlayOpacity = block.colorOverlayOpacity !== undefined ? block.colorOverlayOpacity : 0.7;
          const nhDarkOverlayOpacity = block.darkOverlayOpacity !== undefined ? block.darkOverlayOpacity : 0.3;
          const nhTextAlign = block.textAlign || 'center';
          
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
                      ${block.title || block.headline ? `<h1 style="font-size: 42px; font-weight: 700; margin: 0 0 16px 0; font-family: ${fonts.headlineFont}; color: ${nhTextColor}; line-height: 1.2;">${block.title || block.headline}</h1>` : ''}
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
                    ${block.title || block.headline ? `<h1 style="font-size: 42px; font-weight: 700; margin: 0 0 16px 0; font-family: ${fonts.headlineFont}; color: ${nhTextColor}; line-height: 1.2;">${block.title || block.headline}</h1>` : ''}
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
    const footerHTML = generateFooterHTML(footerSettings, companyInfo, tokenData);
    console.log('✅ Footer HTML generated with company:', companyInfo?.name);
    
    html += `
          ${footerHTML}
        </div>
      </div>
    `;
    
    return html;
  }, [blocks, senderConfig, companyInfo, footerSettings]);

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
