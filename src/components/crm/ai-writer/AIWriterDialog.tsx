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
            type: 'newsletter',
            personas: selectedPersonas
          });

          if (contentResponse?.content) {
            // Parse the AI response and update the block
            const parsedContent = parseAIContent(contentResponse.content, block.type);
            
            const enhancedBlock: ContentBlock = {
              ...block,
              headline: parsedContent.headline || block.headline,
              body: parsedContent.body || block.body,
              ctaText: parsedContent.ctaText || block.ctaText,
              ctaUrl: parsedContent.ctaUrl || block.ctaUrl
            };

            // Step 3: Fetch relevant image if this is an image-text block
            if (block.type === 'image-text' && parsedContent.headline) {
              try {
                console.log(`🖼️ Fetching image for: ${parsedContent.headline}`);
                const imageData = await fetchSmartImage(parsedContent.headline, topic);
                if (imageData?.url) {
                  enhancedBlock.imageUrl = imageData.url;
                  enhancedBlock.altText = imageData.alt || parsedContent.headline;
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

  const blockTypeInstructions = {
    'text': 'Create informative text content that provides value to the reader.',
    'image-text': 'Create a compelling headline and descriptive text that would pair well with an image.',
    'button': 'Create a strong call-to-action with motivating text and clear next steps.',
    'quote': 'Create an inspiring quote or testimonial related to the topic.',
    'header': 'Create a compelling header title.',
    'divider': 'This is a visual divider, no content needed.'
  };

  return `Create content for a ${block.type} block in a newsletter about "${topic}".

Block Position: ${blockIndex + 1}
Block Type: ${block.type}
Current Title: ${block.headline || block.title || ''}
Current Content: ${block.body || block.content || ''}

TONE: ${toneInstructions[tone] || toneInstructions.professional}
BLOCK PURPOSE: ${blockTypeInstructions[block.type] || 'Create relevant content for this section.'}

${customInstructions ? `CUSTOM REQUIREMENTS: ${customInstructions}` : ''}

Please provide content in this JSON format:
{
  "headline": "Compelling headline or title",
  "body": "Main content text (2-3 sentences for image-text blocks, longer for text blocks)",
  "ctaText": "Call-to-action button text (if applicable)",
  "ctaUrl": "#" 
}

Make the content specific to ${topic} and ensure it's valuable for garden center customers.`;
};

const parseAIContent = (content: string, blockType: string) => {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(content);
    return {
      headline: parsed.headline || parsed.title || '',
      body: parsed.body || parsed.content || '',
      ctaText: parsed.ctaText || parsed.buttonText || '',
      ctaUrl: parsed.ctaUrl || parsed.buttonUrl || '#'
    };
  } catch {
    // Fallback to plain text parsing
    const lines = content.split('\n').filter(line => line.trim());
    return {
      headline: lines[0] || '',
      body: lines.slice(1).join('\n') || content,
      ctaText: blockType === 'button' ? 'Learn More' : '',
      ctaUrl: '#'
    };
  }
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
