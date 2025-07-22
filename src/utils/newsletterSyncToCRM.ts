import { supabase } from '@/integrations/supabase/client';
import { processNewsletterContent } from './newsletterContentProcessor';
import { ContentBlock } from '@/types/emailBuilder';

interface NewsletterSyncResult {
  success: boolean;
  campaignId?: string;
  errors?: string[];
}

interface ValidationError {
  blockIndex: number;
  field: string;
  message: string;
}

interface SyncableBlock {
  id: string;
  block_type: string;
  content: Record<string, any>;
  order_index: number;
  image_url?: string;
  cta_url?: string;
  cta_text?: string;
}

export const validateNewsletterForSync = (content: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!content || content.trim().length === 0) {
    errors.push('Newsletter content is empty');
    return { isValid: false, errors };
  }

  const processed = processNewsletterContent(content);
  
  if (!processed.isStructured) {
    errors.push('Newsletter must be in structured format with proper blocks');
    return { isValid: false, errors };
  }

  // Validate each block
  processed.blocks.forEach((block: any, index: number) => {
    const blockErrors = validateBlock(block, index);
    errors.push(...blockErrors);
  });

  // Check for minimum content requirements
  if (processed.blocks.length === 0) {
    errors.push('Newsletter must have at least one content block');
  }

  // Validate newsletter metadata
  if (!processed.meta.theme || processed.meta.theme.trim() === '') {
    errors.push('Newsletter must have a theme');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateBlock = (block: any, index: number): string[] => {
  const errors: string[] = [];
  const blockNum = index + 1;

  if (!block.type) {
    errors.push(`Block ${blockNum}: Missing block type`);
    return errors;
  }

  switch (block.type) {
    case 'header':
      if (!block.title || block.title.trim() === '') {
        errors.push(`Block ${blockNum} (Header): Missing headline`);
      }
      break;
      
    case 'text':
      if (!block.body || block.body.trim() === '') {
        errors.push(`Block ${blockNum} (Text): Missing content`);
      }
      break;
      
    case 'image':
      if (!block.image_url && !block.image_prompt) {
        errors.push(`Block ${blockNum} (Image): Missing image URL or image prompt`);
      }
      if (!block.alt_text) {
        errors.push(`Block ${blockNum} (Image): Missing alt text for accessibility`);
      }
      break;
      
    case 'button':
      if (!block.cta || block.cta.trim() === '') {
        errors.push(`Block ${blockNum} (Button): Missing button text`);
      }
      if (!block.link || !isValidUrl(block.link)) {
        errors.push(`Block ${blockNum} (Button): Missing or invalid button URL`);
      }
      break;
      
    case 'product':
      if (!block.title || block.title.trim() === '') {
        errors.push(`Block ${blockNum} (Product): Missing product title`);
      }
      if (!block.image_url && !block.image_prompt) {
        errors.push(`Block ${blockNum} (Product): Missing product image`);
      }
      break;
  }

  return errors;
};

const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

export const convertNewsletterBlocksToCRM = (processedNewsletter: any): ContentBlock[] => {
  const crmBlocks: ContentBlock[] = [];

  processedNewsletter.blocks.forEach((block: any, index: number) => {
    const crmBlock: ContentBlock = {
      id: `block-${index}`,
      type: mapBlockTypeToCRM(block.type) as any,
      source: 'newsletter' as const,
      visible: true,
      alignment: 'left' as const,
      padding: 'medium' as const,
      margin: 'medium' as const,
    };

    // Map block-specific content based on type
    switch (block.type) {
      case 'header':
        crmBlock.headline = block.title;
        crmBlock.body = block.body;
        crmBlock.content = JSON.stringify({
          headline: block.title,
          body: block.body || '',
          backgroundColor: block.background_color || ''
        });
        break;

      case 'text':
        crmBlock.title = block.title;
        crmBlock.content = JSON.stringify({
          title: block.title || '',
          body: block.body || '',
          textAlign: 'left'
        });
        break;

      case 'image':
        crmBlock.imageUrl = block.image_url;
        crmBlock.altText = block.alt_text;
        crmBlock.caption = block.caption;
        crmBlock.content = JSON.stringify({
          imageUrl: block.image_url || '',
          altText: block.alt_text || '',
          caption: block.caption || '',
          alignment: 'center'
        });
        break;

      case 'button':
        crmBlock.buttonText = block.cta;
        crmBlock.buttonUrl = block.link;
        crmBlock.heading = block.title;
        crmBlock.content = JSON.stringify({
          heading: block.title || '',
          body: block.body || '',
          buttonText: block.cta || '',
          buttonUrl: block.link || '',
          buttonStyle: 'primary'
        });
        break;

      case 'product':
        crmBlock.title = block.title;
        crmBlock.imageUrl = block.image_url;
        crmBlock.buttonText = block.cta || 'Learn More';
        crmBlock.buttonUrl = block.link;
        crmBlock.content = JSON.stringify({
          title: block.title || '',
          description: block.body || '',
          imageUrl: block.image_url || '',
          price: block.price || '',
          buttonText: block.cta || 'Learn More',
          buttonUrl: block.link || ''
        });
        break;

      default:
        // Handle unknown block types as text blocks
        crmBlock.type = 'text';
        crmBlock.content = JSON.stringify({
          title: block.title || '',
          body: block.body || JSON.stringify(block),
          textAlign: 'left'
        });
    }

    crmBlocks.push(crmBlock);
  });

  return crmBlocks;
};

const mapBlockTypeToCRM = (newsletterType: string): string => {
  const typeMap: Record<string, string> = {
    'header': 'header',
    'text': 'text',
    'image': 'image',
    'button': 'button',
    'product': 'product'
  };
  
  return typeMap[newsletterType] || 'text';
};

export const syncNewsletterToCRM = async (
  contentTaskId: string,
  themeCampaignId: string,
  userId: string
): Promise<NewsletterSyncResult> => {
  try {
    console.log('🔄 Starting newsletter to CRM sync', { contentTaskId, themeCampaignId, userId });

    // Fetch newsletter content
    const { data: contentTask, error: taskError } = await supabase
      .from('content_tasks')
      .select(`
        *,
        campaigns(
          id,
          title,
          theme,
          week_number,
          description
        )
      `)
      .eq('id', contentTaskId)
      .single();

    if (taskError || !contentTask) {
      throw new Error(`Failed to fetch newsletter content: ${taskError?.message}`);
    }

    const content = contentTask.ai_output;
    if (!content) {
      throw new Error('Newsletter content is empty');
    }

    // Validate newsletter content
    const validation = validateNewsletterForSync(content);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    // Check if already synced
    const { data: existingCampaign } = await supabase
      .from('crm_campaigns')
      .select('id')
      .eq('synced_from', themeCampaignId)
      .eq('user_id', userId)
      .single();

    if (existingCampaign) {
      return {
        success: false,
        errors: ['This newsletter has already been synced to CRM']
      };
    }

    // Process newsletter content
    const processed = processNewsletterContent(content, contentTask.campaigns?.title);
    const crmBlocks = convertNewsletterBlocksToCRM(processed);

    // Create CRM campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('crm_campaigns')
      .insert({
        user_id: userId,
        name: `📧 ${contentTask.campaigns?.title || 'Newsletter Campaign'}`,
        subject_line: `🌱 ${processed.meta.theme} - Your Garden Update`,
        status: 'draft',
        synced_from: themeCampaignId,
        metadata: {
          themeTitle: contentTask.campaigns?.title,
          themeCampaignId: themeCampaignId,
          weekNumber: contentTask.campaigns?.week_number,
          personaTags: extractPersonaTags(content),
          originalContentTaskId: contentTaskId,
          syncedAt: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Failed to create CRM campaign: ${campaignError?.message}`);
    }

    // Create campaign blocks
    const blockInserts = crmBlocks.map((block, index) => {
      const insertData: any = {
        campaign_id: campaign.id,
        block_type: block.type,
        content: JSON.parse(block.content || '{}'),
        image_url: block.imageUrl || null,
        cta_url: block.buttonUrl || null,
        cta_text: block.buttonText || null,
        order_index: index,
        source: 'newsletter',
        persona_tag: null
      };
      return insertData;
    });

    const { error: blocksError } = await supabase
      .from('campaign_blocks')
      .insert(blockInserts);

    if (blocksError) {
      // Cleanup: delete the campaign if block creation fails
      await supabase.from('crm_campaigns').delete().eq('id', campaign.id);
      throw new Error(`Failed to create campaign blocks: ${blocksError.message}`);
    }

    console.log('✅ Newsletter synced to CRM successfully', { campaignId: campaign.id });

    return {
      success: true,
      campaignId: campaign.id
    };

  } catch (error) {
    console.error('❌ Newsletter to CRM sync failed:', error);
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    };
  }
};

const extractPersonaTags = (content: string): string[] => {
  const tags: string[] = [];
  const lowerContent = content.toLowerCase();

  if (lowerContent.includes('beginner') || lowerContent.includes('new gardener')) {
    tags.push('Beginner Gardeners');
  }
  if (lowerContent.includes('expert') || lowerContent.includes('advanced')) {
    tags.push('Expert Gardeners');
  }
  if (lowerContent.includes('vegetable') || lowerContent.includes('herb')) {
    tags.push('Vegetable Gardeners');
  }
  if (lowerContent.includes('flower') || lowerContent.includes('bloom')) {
    tags.push('Flower Enthusiasts');
  }
  if (lowerContent.includes('indoor') || lowerContent.includes('houseplant')) {
    tags.push('Indoor Plant Lovers');
  }

  return tags;
};

export const checkSyncStatus = async (themeCampaignId: string, userId: string): Promise<{
  isSynced: boolean;
  campaignId?: string;
}> => {
  const { data: campaign } = await supabase
    .from('crm_campaigns')
    .select('id')
    .eq('synced_from', themeCampaignId)
    .eq('user_id', userId)
    .single();

  return {
    isSynced: !!campaign,
    campaignId: campaign?.id
  };
};