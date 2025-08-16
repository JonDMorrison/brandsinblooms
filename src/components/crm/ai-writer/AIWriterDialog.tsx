import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles } from 'lucide-react';
import { usePersonaAwareGeneration } from '@/hooks/usePersonaAwareGeneration';
import { generateNewsletterBlocks } from '@/services/newsletterBlockGenerator';
import { fetchSmartImage } from '@/services/unsplashService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ContentBlock } from '@/types/emailBuilder';

interface AIWriterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContentGenerated: (data: {
    campaignName: string;
    subjectLine: string;
    preheaderText: string;
    blocks: ContentBlock[];
  }) => void;
}

export const AIWriterDialog: React.FC<AIWriterDialogProps> = ({
  open,
  onOpenChange,
  onContentGenerated
}) => {
  const [topic, setTopic] = useState('');
  const [layout, setLayout] = useState<'block-builder' | 'simple-email'>('block-builder');
  const [tone, setTone] = useState('professional');
  const [customInstructions, setCustomInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  
  const { selectedPersonas, generateEmailContent } = usePersonaAwareGeneration();
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({
        title: "Missing Topic",
        description: "Please enter a topic for your newsletter.",
        variant: "destructive"
      });
      return;
    }

    setGenerating(true);
    
    try {
      // Step 1: Generate basic newsletter structure
      console.log('🎨 Generating newsletter structure for:', topic);
      const baseBlocks = generateNewsletterBlocks({
        topic: topic,
        layout: layout,
        templateBlocks: []
      });

      if (baseBlocks.length === 0) {
        throw new Error('Failed to generate base newsletter structure');
      }

      // Step 2: Enhance content with AI for each block
      const enhancedBlocks: ContentBlock[] = [];
      
      for (let i = 0; i < baseBlocks.length; i++) {
        const block = baseBlocks[i];
        console.log(`🤖 Enhancing block ${i + 1}/${baseBlocks.length} (${block.type})`);
        
        if (block.type === 'header' || block.type === 'divider') {
          // Keep header and divider blocks as-is
          enhancedBlocks.push(block);
          continue;
        }

        try {
          // Generate enhanced content for this block
          const blockPrompt = createBlockPrompt(block, topic, tone, customInstructions, i);
          
          const contentResponse = await generateEmailContent({
            prompt: blockPrompt,
            type: 'email_block',
            postType: 'newsletter',
            personas: selectedPersonas
          });

          if (contentResponse?.content) {
            // Parse the AI response and update the block
            const parsedContent = parseAIContent(contentResponse.content, block.type);
            
            // Validate content quality before applying
            const isContentValid = validateContentQuality(parsedContent, topic);
            if (!isContentValid) {
              console.warn(`Block ${i}: Content quality failed, retrying...`);
              // Retry with more specific prompt
              const retryPrompt = createRetryPrompt(block, topic, tone, customInstructions, i);
              const retryResponse = await generateEmailContent({
                prompt: retryPrompt,
                type: 'email_block',
                postType: 'newsletter', 
                personas: selectedPersonas
              });
              
              if (retryResponse?.content) {
                const retryParsed = parseAIContent(retryResponse.content, block.type);
                if (validateContentQuality(retryParsed, topic)) {
                  Object.assign(parsedContent, retryParsed);
                }
              }
            }

            const enhancedBlock: ContentBlock = {
              ...block,
              // Update both display fields AND data fields
              title: parsedContent.headline || block.title,
              content: parsedContent.body || block.content,
              headline: parsedContent.headline || block.headline,
              body: parsedContent.body || block.body,
              ctaText: parsedContent.ctaText || block.ctaText,
              ctaUrl: parsedContent.ctaUrl || block.ctaUrl
            };

            // Step 3: Fetch relevant image for each content block
            if (block.type === 'image-text') {
              try {
                // Create topic-specific image search terms
                const imageKeywords = createImageKeywords(topic, i);
                console.log(`🖼️ Fetching image with keywords: ${imageKeywords}`);
                
                const imageData = await fetchSmartImage(imageKeywords, topic, topic.toLowerCase().includes('hydrangea'));
                if (imageData?.url) {
                  enhancedBlock.imageUrl = imageData.url;
                  enhancedBlock.altText = imageData.alt || `${topic} - ${parsedContent.headline}`;
                } else {
                  // Fallback to topic-only search
                  const fallbackImage = await fetchSmartImage(topic, 'gardening');
                  if (fallbackImage?.url) {
                    enhancedBlock.imageUrl = fallbackImage.url;
                    enhancedBlock.altText = fallbackImage.alt || topic;
                  }
                }
              } catch (error) {
                console.warn('Failed to fetch image for block:', error);
              }
            }

            enhancedBlocks.push(enhancedBlock);
          } else {
            // Fallback to original block if AI generation fails
            enhancedBlocks.push(block);
          }
        } catch (error) {
          console.warn(`Failed to enhance block ${i}:`, error);
          enhancedBlocks.push(block);
        }
      }

      // Step 4: Generate subject line and preheader
      const subjectLine = generateSubjectLine(topic, tone);
      const preheaderText = generatePreheaderText(topic, tone);

      // Return the generated content
      onContentGenerated({
        campaignName: topic,
        subjectLine: subjectLine,
        preheaderText: preheaderText,
        blocks: enhancedBlocks
      });

      onOpenChange(false);
      
      toast({
        title: "Newsletter Generated!",
        description: `Created ${enhancedBlocks.length} blocks with AI-powered content and images.`,
      });

    } catch (error: any) {
      console.error('Failed to generate newsletter:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate newsletter content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => {
    setTopic('');
    setLayout('block-builder');
    setTone('professional');
    setCustomInstructions('');
  };

  const handleClose = (open: boolean) => {
    if (!generating) {
      if (!open) reset();
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Write with AI
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="topic">Newsletter Topic *</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Spring Gardening Tips"
              disabled={generating}
            />
          </div>

          <div>
            <Label htmlFor="layout">Layout Style</Label>
            <NativeSelect
              value={layout}
              onChange={(e) => setLayout(e.target.value as 'block-builder' | 'simple-email')}
              disabled={generating}
            >
              <option value="block-builder">Rich Layout (Multiple sections with images)</option>
              <option value="simple-email">Simple Layout (Text-focused)</option>
            </NativeSelect>
          </div>

          <div>
            <Label htmlFor="tone">Writing Tone</Label>
            <NativeSelect
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              disabled={generating}
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="expert">Expert</option>
              <option value="casual">Casual</option>
              <option value="educational">Educational</option>
            </NativeSelect>
          </div>

          <div>
            <Label htmlFor="instructions">Additional Instructions (Optional)</Label>
            <Textarea
              id="instructions"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Any specific requirements or focus areas..."
              className="h-20"
              disabled={generating}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={generating || !topic.trim()}
              className="flex-1"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Newsletter
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={generating}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Helper functions
const createBlockPrompt = (
  block: ContentBlock,
  topic: string,
  tone: string,
  customInstructions: string,
  blockIndex: number
): string => {
  const toneInstructions = {
    professional: 'Use a professional, authoritative tone that builds trust and credibility.',
    friendly: 'Use a warm, approachable tone that feels like advice from a knowledgeable friend.',
    expert: 'Use an expert tone with technical details and industry-specific knowledge.',
    casual: 'Use a conversational, relaxed tone that is easy to read and engaging.',
    educational: 'Use an instructional tone that teaches and guides readers step-by-step.'
  };

  // Map block positions to newsletter sections
  const sectionMapping = {
    0: 'Featured Story',
    1: 'Main Article', 
    2: 'Secondary Feature',
    3: 'Call to Action'
  };

  const sectionName = sectionMapping[blockIndex] || `Section ${blockIndex + 1}`;
  
  const sectionInstructions = {
    'Featured Story': {
      headline: 'Create an attention-grabbing headline that highlights the most important aspect of this topic',
      body: 'Write 4-5 sentences that introduce the topic, explain why it\'s important now, and give readers a preview of what they\'ll learn. Make it engaging and informative.',
      length: '100-150 words'
    },
    'Main Article': {
      headline: 'Create an informative headline that promises practical value',
      body: 'Write detailed content with 6-8 sentences covering key techniques, best practices, and actionable advice. Include specific tips that garden center customers can immediately apply.',
      length: '150-200 words'
    },
    'Secondary Feature': {
      headline: 'Create a compelling headline for a supporting topic or related tip',
      body: 'Write 3-4 sentences that complement the main article with additional insights, related products, or seasonal considerations.',
      length: '80-120 words'
    },
    'Call to Action': {
      headline: 'Create an action-oriented headline that motivates engagement',
      body: 'Write 2-3 sentences that encourage readers to take a specific action, whether visiting the garden center, trying a technique, or learning more.',
      length: '50-80 words'
    }
  };

  const section = sectionInstructions[sectionName] || sectionInstructions['Featured Story'];

  return `You are writing the "${sectionName}" section for a professional garden center newsletter about "${topic}".

SECTION REQUIREMENTS:
- ${section.headline}
- ${section.body}
- Target length: ${section.length}
- Make content specific to ${topic} with practical, actionable advice
- Include relevant seasonal timing, care instructions, or product recommendations
- Write for garden center customers (both beginners and experienced gardeners)

TONE: ${toneInstructions[tone] || toneInstructions.professional}

${customInstructions ? `ADDITIONAL REQUIREMENTS: ${customInstructions}` : ''}

CRITICAL: Return ONLY a valid JSON object with this exact format:
{
  "headline": "Specific headline about ${topic}",
  "body": "Detailed, informative content about ${topic} (${section.length})",
  "ctaText": "${sectionName === 'Call to Action' ? 'Visit Our Garden Center' : ''}",
  "ctaUrl": "${sectionName === 'Call to Action' ? '#' : ''}"
}

Make sure the content is rich, specific, and valuable - not generic gardening advice.`;
};

const parseAIContent = (content: string, blockType: string) => {
  try {
    // Clean the content and try to extract JSON
    let cleanContent = content.trim();
    
    // Remove any markdown code blocks
    cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Find JSON object in the response
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        headline: parsed.headline || parsed.title || '',
        body: parsed.body || parsed.content || '',
        ctaText: parsed.ctaText || parsed.cta_text || parsed.buttonText || '',
        ctaUrl: parsed.ctaUrl || parsed.cta_url || parsed.buttonUrl || '#'
      };
    }
    
    throw new Error('No JSON found');
  } catch (error) {
    console.warn('Failed to parse AI content as JSON:', error);
    
    // More robust fallback parsing
    const lines = content.split('\n').filter(line => line.trim());
    const headline = lines.find(line => 
      line.includes('headline') || 
      line.includes('title') || 
      (!line.includes(':') && line.length > 10 && line.length < 100)
    ) || lines[0] || '';
    
    const bodyLines = lines.filter(line => 
      !line.includes('headline') && 
      !line.includes('title') && 
      line.length > 20
    );
    
    return {
      headline: headline.replace(/["'{}:]/g, '').replace(/headline|title/g, '').trim(),
      body: bodyLines.join(' ').replace(/["'{}:]/g, '').trim() || content,
      ctaText: blockType === 'button' ? 'Learn More' : '',
      ctaUrl: '#'
    };
  }
};

const createImageKeywords = (topic: string, blockIndex: number): string => {
  // Create specific image search terms based on the topic and section
  const topicKeywords = topic.toLowerCase();
  
  // Force hydrangea-specific keywords if topic contains hydrangea
  if (topicKeywords.includes('hydrangea')) {
    const hydrangeaSectionKeywords = {
      0: 'hydrangea featured summer garden', // Featured Story
      1: 'hydrangea care tips pruning', // Main Article  
      2: 'hydrangea garden center display varieties', // Secondary Feature
      3: 'hydrangea healthy plants blooming' // Call to Action
    };
    return hydrangeaSectionKeywords[blockIndex] || 'hydrangea summer garden';
  }
  
  const sectionKeywords = {
    0: 'featured beautiful', // Featured Story
    1: 'care growing tips', // Main Article  
    2: 'garden center display', // Secondary Feature
    3: 'healthy plants garden' // Call to Action
  };
  
  const sectionModifier = sectionKeywords[blockIndex] || 'gardening';
  return `${topicKeywords} ${sectionModifier}`;
};

const generateSubjectLine = (topic: string, tone: string): string => {
  const toneVariants = {
    professional: [`${topic} - Expert Insights`, `Professional Guide: ${topic}`],
    friendly: [`Your ${topic} Guide is Here!`, `Let's Talk ${topic} 🌱`],
    expert: [`Advanced ${topic} Techniques`, `Master ${topic} with These Tips`],
    casual: [`${topic} Made Easy`, `Quick ${topic} Tips Inside`],
    educational: [`Learn ${topic} - Step by Step`, `${topic} Tutorial & Tips`]
  };

  const variants = toneVariants[tone] || toneVariants.professional;
  return variants[Math.floor(Math.random() * variants.length)];
};

const generatePreheaderText = (topic: string, tone: string): string => {
  const preheaders = [
    `Essential tips and insights for ${topic.toLowerCase()}`,
    `Everything you need to know about ${topic.toLowerCase()}`,
    `Professional advice for successful ${topic.toLowerCase()}`,
    `Expert guidance for ${topic.toLowerCase()} success`
  ];
  
  return preheaders[Math.floor(Math.random() * preheaders.length)];
};

// Quality validation function
const validateContentQuality = (content: any, topic: string): boolean => {
  const { headline, body } = content;
  
  // Check minimum length requirements
  if (!headline || headline.length < 10 || !body || body.length < 50) {
    return false;
  }
  
  // Check for generic phrases that should be avoided
  const genericPhrases = [
    'latest updates and insights',
    'this week\'s newsletter',
    'welcome to this week',
    'share your expertise',
    'tips or latest news',
    'your main content area',
    'keep it engaging',
    'valuable for your readers',
    'thank you for reading',
    'continued support',
    'take action now',
    'discover what we have'
  ];
  
  const combinedText = (headline + ' ' + body).toLowerCase();
  const hasGenericContent = genericPhrases.some(phrase => 
    combinedText.includes(phrase.toLowerCase())
  );
  
  if (hasGenericContent) {
    return false;
  }
  
  // Check if content mentions the topic
  const topicKeywords = topic.toLowerCase().split(' ');
  const mentionsTopic = topicKeywords.some(keyword => 
    combinedText.includes(keyword.toLowerCase())
  );
  
  return mentionsTopic;
};

// Retry prompt with more specific instructions
const createRetryPrompt = (
  block: ContentBlock,
  topic: string,
  tone: string,
  customInstructions: string,
  blockIndex: number
): string => {
  const basePrompt = createBlockPrompt(block, topic, tone, customInstructions, blockIndex);
  
  return basePrompt + `

CRITICAL RETRY REQUIREMENTS:
- DO NOT use generic newsletter language like "latest updates", "this week's newsletter", or "welcome to"
- MUST mention "${topic}" specifically in both headline and body content
- Provide SPECIFIC, ACTIONABLE information about ${topic}
- Include concrete tips, techniques, or advice related to ${topic}
- Write content that garden center customers would find immediately useful
- Be specific about timing, care instructions, or product recommendations for ${topic}

This is a retry - the previous content was too generic. Make it much more specific and valuable.`;
};
