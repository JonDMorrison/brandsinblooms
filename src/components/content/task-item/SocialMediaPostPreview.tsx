import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Share, Bookmark, Instagram, Facebook } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MediaSelector } from '@/components/image/MediaSelector';
import { toast } from 'sonner';

interface SocialMediaPostPreviewProps {
  content: string;
  postType: 'instagram' | 'facebook';
  className?: string;
  contentTaskId?: string;
  campaignTitle?: string;
}

// Helper function to generate initials from company name
const generateInitials = (companyName: string): string => {
  if (!companyName || companyName.trim() === '') return 'BC';
  
  const words = companyName.trim().split(/\s+/);
  
  if (words.length === 1) {
    // Single word - take first two characters
    const word = words[0].toUpperCase();
    return word.length >= 2 ? word.substring(0, 2) : word + 'C';
  }
  
  // Multiple words - take first letter of first two words
  return words[0][0].toUpperCase() + words[1][0].toUpperCase();
};

// Enhanced content formatting with strict emoji removal
const formatContentForDisplay = (rawContent: string) => {
  console.log('[PREVIEW] Raw content received:', rawContent?.substring(0, 200));
  
  if (!rawContent || rawContent.trim() === '') {
    return { text: '', hashtags: [] };
  }

  // Clean any HTML tags but preserve structure
  let cleanContent = rawContent
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
    .replace(/<h[1-6][^>]*>/gi, '\n\n**') // Convert headers to bold with spacing
    .replace(/<\/h[1-6]>/gi, '**\n\n') // Close headers with spacing
    .replace(/<p[^>]*>/gi, '\n\n') // Convert paragraphs with proper spacing
    .replace(/<\/p>/gi, '') // Close paragraphs
    .replace(/<br[^>]*>/gi, '\n') // Convert line breaks
    .replace(/<li[^>]*>/gi, '\n• ') // Convert list items
    .replace(/<\/li>/gi, '') // Close list items
    .replace(/<ul[^>]*>|<\/ul>/gi, '') // Remove ul tags
    .replace(/<ol[^>]*>|<\/ol>/gi, '') // Remove ol tags
    .replace(/<strong[^>]*>|<b[^>]*>/gi, '**') // Convert bold tags
    .replace(/<\/strong>|<\/b>/gi, '**') // Close bold tags
    .replace(/<em[^>]*>|<i[^>]*>/gi, '*') // Convert italic tags
    .replace(/<\/em>|<\/i>/gi, '*') // Close italic tags
    .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1') // Extract link text
    .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
    .replace(/\\n/g, '\n') // Convert literal \n to actual newlines
    .trim();

  console.log('[PREVIEW] After HTML cleaning:', cleanContent?.substring(0, 200));
  
  // CRITICAL: Remove ALL emojis using comprehensive regex
  cleanContent = cleanContent.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1F0}-\u{1F1FF}]|[\u{1F170}-\u{1F251}]|[\u{1F004}\u{1F0CF}]|[\u{1F18E}]|[\u{3030}\u{2B50}\u{2B55}]|[\u{203C}\u{2049}\u{2122}\u{2139}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{231A}-\u{231B}]|[\u{2328}]|[\u{23CF}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{24C2}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2600}-\u{2604}]|[\u{260E}]|[\u{2611}]|[\u{2614}-\u{2615}]|[\u{2618}]|[\u{261D}]|[\u{2620}]|[\u{2622}-\u{2623}]|[\u{2626}]|[\u{262A}]|[\u{262E}-\u{262F}]|[\u{2638}-\u{263A}]|[\u{2640}]|[\u{2642}]|[\u{2648}-\u{2653}]|[\u{265F}-\u{2660}]|[\u{2663}]|[\u{2665}-\u{2666}]|[\u{2668}]|[\u{267B}]|[\u{267E}-\u{267F}]|[\u{2692}-\u{2697}]|[\u{2699}]|[\u{269B}-\u{269C}]|[\u{26A0}-\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26B0}-\u{26B1}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26C8}]|[\u{26CE}]|[\u{26CF}]|[\u{26D1}]|[\u{26D3}-\u{26D4}]|[\u{26E9}-\u{26EA}]|[\u{26F0}-\u{26F5}]|[\u{26F7}-\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{2709}]|[\u{270A}-\u{270B}]|[\u{270C}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3297}]|[\u{3299}]/gu, '');
  
  // Additional emoji cleanup - remove common emoji ranges
  cleanContent = cleanContent
    .replace(/[\u{1F170}-\u{1F251}]/gu, '') // Additional symbols
    .replace(/[\u{1F004}\u{1F0CF}]/gu, '') // Mahjong and playing cards
    .replace(/[\u{1F18E}]/gu, '') // AB button
    .replace(/[\u{3030}\u{2B50}\u{2B55}]/gu, '') // Wavy dash, star, heavy large circle
    .replace(/[\u{203C}\u{2049}\u{2122}\u{2139}]/gu, '') // Punctuation symbols
    .replace(/[\u{2194}-\u{2199}]/gu, '') // Arrow symbols
    .replace(/[\u{21A9}-\u{21AA}]/gu, '') // Hook arrows
    .replace(/[\u{231A}-\u{231B}]/gu, '') // Watch symbols
    .replace(/[\u{2328}]/gu, '') // Keyboard
    .replace(/[\u{23CF}]/gu, '') // Eject symbol
    .replace(/[\u{23E9}-\u{23F3}]/gu, '') // Media control symbols
    .replace(/[\u{23F8}-\u{23FA}]/gu, '') // Additional media symbols
    .replace(/[\u{24C2}]/gu, '') // Circled M
    .replace(/[\u{25AA}-\u{25AB}]/gu, '') // Black/white squares
    .replace(/[\u{25B6}]/gu, '') // Play button
    .replace(/[\u{25C0}]/gu, '') // Reverse button
    .replace(/[\u{25FB}-\u{25FE}]/gu, '') // Square symbols
    .replace(/[\u{2600}-\u{2604}]/gu, '') // Weather symbols
    .replace(/[\u{260E}]/gu, '') // Telephone
    .replace(/[\u{2611}]/gu, '') // Ballot box with check
    .replace(/[\u{2614}-\u{2615}]/gu, '') // Umbrella and hot beverage
    .replace(/[\u{2618}]/gu, '') // Shamrock
    .replace(/[\u{261D}]/gu, '') // Pointing finger
    .replace(/[\u{2620}]/gu, '') // Skull and crossbones
    .replace(/[\u{2622}-\u{2623}]/gu, '') // Radioactive and biohazard
    .replace(/[\u{2626}]/gu, '') // Orthodox cross
    .replace(/[\u{262A}]/gu, '') // Star and crescent
    .replace(/[\u{262E}-\u{262F}]/gu, '') // Peace symbol and yin yang
    .replace(/[\u{2638}-\u{263A}]/gu, '') // Wheel of dharma and smiley
    .replace(/[\u{2640}]/gu, '') // Female sign
    .replace(/[\u{2642}]/gu, '') // Male sign
    .replace(/[\u{2648}-\u{2653}]/gu, '') // Zodiac signs
    .replace(/[\u{265F}-\u{2660}]/gu, '') // Chess and spades
    .replace(/[\u{2663}]/gu, '') // Clubs
    .replace(/[\u{2665}-\u{2666}]/gu, '') // Hearts and diamonds
    .replace(/[\u{2668}]/gu, '') // Hot springs
    .replace(/[\u{267B}]/gu, '') // Recycling symbol
    .replace(/[\u{267E}-\u{267F}]/gu, '') // Infinity and wheelchair
    .replace(/[\u{2692}-\u{2697}]/gu, '') // Tools and symbols
    .replace(/[\u{2699}]/gu, '') // Gear
    .replace(/[\u{269B}-\u{269C}]/gu, '') // Atom and fleur-de-lis
    .replace(/[\u{26A0}-\u{26A1}]/gu, '') // Warning and high voltage
    .replace(/[\u{26AA}-\u{26AB}]/gu, '') // White and black circles
    .replace(/[\u{26B0}-\u{26B1}]/gu, '') // Coffin and funeral urn
    .replace(/[\u{26BD}-\u{26BE}]/gu, '') // Soccer and baseball
    .replace(/[\u{26C4}-\u{26C5}]/gu, '') // Snowman and sun
    .replace(/[\u{26C8}]/gu, '') // Thunder cloud and rain
    .replace(/[\u{26CE}]/gu, '') // Ophiuchus
    .replace(/[\u{26CF}]/gu, '') // Pick
    .replace(/[\u{26D1}]/gu, '') // Helmet with cross
    .replace(/[\u{26D3}-\u{26D4}]/gu, '') // Chains and no entry
    .replace(/[\u{26E9}-\u{26EA}]/gu, '') // Shinto shrine and church
    .replace(/[\u{26F0}-\u{26F5}]/gu, '') // Mountain to sailboat
    .replace(/[\u{26F7}-\u{26FA}]/gu, '') // Skier to tent
    .replace(/[\u{26FD}]/gu, '') // Fuel pump
    .replace(/[\u{2702}]/gu, '') // Scissors
    .replace(/[\u{2705}]/gu, '') // Check mark button
    .replace(/[\u{2708}-\u{2709}]/gu, '') // Airplane and envelope
    .replace(/[\u{270A}-\u{270B}]/gu, '') // Fists
    .replace(/[\u{270C}-\u{270D}]/gu, '') // Victory hand and writing hand
    .replace(/[\u{270F}]/gu, '') // Pencil
    .replace(/[\u{2712}]/gu, '') // Black nib
    .replace(/[\u{2714}]/gu, '') // Check mark
    .replace(/[\u{2716}]/gu, '') // Multiplication X
    .replace(/[\u{271D}]/gu, '') // Latin cross
    .replace(/[\u{2721}]/gu, '') // Star of David
    .replace(/[\u{2728}]/gu, '') // Sparkles
    .replace(/[\u{2733}-\u{2734}]/gu, '') // Asterisks
    .replace(/[\u{2744}]/gu, '') // Snowflake
    .replace(/[\u{2747}]/gu, '') // Sparkle
    .replace(/[\u{274C}]/gu, '') // Cross mark
    .replace(/[\u{274E}]/gu, '') // Cross mark button
    .replace(/[\u{2753}-\u{2755}]/gu, '') // Question marks
    .replace(/[\u{2757}]/gu, '') // Exclamation mark
    .replace(/[\u{2763}-\u{2764}]/gu, '') // Hearts
    .replace(/[\u{2795}-\u{2797}]/gu, '') // Plus/minus/division
    .replace(/[\u{27A1}]/gu, '') // Right arrow
    .replace(/[\u{27B0}]/gu, '') // Curly loop
    .replace(/[\u{27BF}]/gu, '') // Double curly loop
    .replace(/[\u{2934}-\u{2935}]/gu, '') // Curved arrows
    .replace(/[\u{2B05}-\u{2B07}]/gu, '') // Arrows
    .replace(/[\u{2B1B}-\u{2B1C}]/gu, '') // Black and white squares
    .replace(/[\u{2B50}]/gu, '') // Star
    .replace(/[\u{2B55}]/gu, '') // Heavy large circle
    .replace(/[\u{3297}]/gu, '') // Congratulations button
    .replace(/[\u{3299}]/gu, ''); // Secret button

  console.log('[PREVIEW] After emoji removal:', cleanContent?.substring(0, 200));
  
  // Extract hashtags before further formatting
  const hashtagRegex = /#[\w]+/g;
  const hashtags = cleanContent.match(hashtagRegex) || [];
  
  // Remove hashtags from main text but preserve formatting
  let textWithoutHashtags = cleanContent.replace(hashtagRegex, '').trim();
  
  // Clean up excessive whitespace while preserving intentional formatting
  textWithoutHashtags = textWithoutHashtags
    .replace(/\n\s*\n\s*\n+/g, '\n\n') // Convert 3+ line breaks to double
    .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs (but not line breaks)
    .replace(/^\s+|\s+$/gm, '') // Trim whitespace from start/end of each line
    .trim();

  // Enhanced content formatting for better readability
  let formattedText = textWithoutHashtags;
  
  // If content is one long paragraph, try to break it up
  if (formattedText.length > 150 && !formattedText.includes('\n\n')) {
    // Split on sentence boundaries and group into smaller paragraphs
    const sentences = formattedText.split(/(?<=[.!?])\s+/);
    const paragraphs = [];
    let currentParagraph = '';
    
    sentences.forEach((sentence, index) => {
      currentParagraph += sentence + ' ';
      
      // Break into new paragraph every 2-3 sentences or at logical breaks
      if ((index + 1) % 3 === 0 || sentence.length > 100 || index === sentences.length - 1) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = '';
      }
    });
    
    formattedText = paragraphs.join('\n\n');
  }

  console.log('[PREVIEW] Final formatted text:', formattedText?.substring(0, 200));
  console.log('[PREVIEW] Extracted hashtags:', hashtags);

  return { 
    text: formattedText, 
    hashtags
  };
};

export const SocialMediaPostPreview = ({ content, postType, className, contentTaskId, campaignTitle }: SocialMediaPostPreviewProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // Fetch company profile data
  const { data: companyProfile } = useQuery({
    queryKey: ['company-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('company_profiles')
        .select('company_name')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching company profile:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch existing content task data to get current image
  const { data: contentTask } = useQuery({
    queryKey: ['content-task', contentTaskId],
    queryFn: async () => {
      if (!contentTaskId) return null;
      
      const { data, error } = await supabase
        .from('content_tasks')
        .select('attachments, image_url')
        .eq('id', contentTaskId)
        .single();
      
      if (error) {
        console.error('Error fetching content task:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!contentTaskId,
  });

  // Update local state when content task data loads
  useEffect(() => {
    if (contentTask?.image_url) {
      setSelectedImageUrl(contentTask.image_url);
    }
  }, [contentTask]);

  // Mutation to update content task with selected image
  const updateImageMutation = useMutation({
    mutationFn: async ({ imageUrl, metadata }: { imageUrl: string; metadata?: any }) => {
      if (!contentTaskId) throw new Error('No content task ID');
      
      const { error } = await supabase
        .from('content_tasks')
        .update({
          image_url: imageUrl,
          attachments: metadata ? { image: metadata } : null
        })
        .eq('id', contentTaskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-task', contentTaskId] });
      toast.success('Image updated successfully');
    },
    onError: (error) => {
      console.error('Error updating image:', error);
      toast.error('Failed to update image');
    },
  });

  // Get company name with fallback
  const companyName = companyProfile?.company_name || 'Your Business';
  const companyInitials = generateInitials(companyName);

  // Enhanced content processing with strict emoji removal
  const { text, hashtags } = formatContentForDisplay(content);

  const getPlatformIcon = () => {
    return postType === 'instagram' ? (
      <Instagram className="w-5 h-5 text-pink-600" />
    ) : (
      <Facebook className="w-5 h-5 text-gray-600" />
    );
  };

  const getPlatformStyle = () => {
    return postType === 'instagram' 
      ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-pink-200'
      : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200';
  };

  return (
    <div className={cn('rounded-lg border-2 overflow-hidden shadow-sm', getPlatformStyle(), className)}>
      {/* Platform Header */}
      <div className="flex items-center gap-3 p-4 bg-white border-b">
        {getPlatformIcon()}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">{companyInitials}</span>
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900">{companyName}</p>
              <p className="text-xs text-gray-500">2 hours ago</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-xs capitalize">
          {postType}
        </Badge>
      </div>

      {/* Main Content Area - 50/50 Split */}
      <div className="flex">
        {/* Text Content - Left 50% */}
        <div className="flex-1 p-4 space-y-3">
          <div className="prose prose-sm max-w-none">
            {text && text.trim() !== '' ? (
              <div className="text-gray-800 leading-relaxed space-y-3">
                {text.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="text-sm">
                    {paragraph.trim()}
                  </p>
                ))}
              </div>
            ) : (
              <div className="text-gray-400 italic text-sm">
                <p>Content is being generated...</p>
              </div>
            )}
          </div>

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {hashtags.map((tag, index) => (
                <span 
                  key={index}
                  className="text-gray-600 text-sm font-medium hover:underline cursor-pointer"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Mock Engagement */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between text-gray-500">
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-1 hover:text-red-500 transition-colors">
                  <Heart className="w-4 h-4" />
                  <span className="text-xs">24</span>
                </button>
                <button className="flex items-center gap-1 hover:text-gray-700 transition-colors">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-xs">3</span>
                </button>
                <button className="flex items-center gap-1 hover:text-gray-700 transition-colors">
                  <Share className="w-4 h-4" />
                </button>
              </div>
              <button className="hover:text-gray-700 transition-colors">
                <Bookmark className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Image Area - Right 50% */}
        <div className="flex-1 border-l border-gray-200">
          <div className="p-4 h-full">
            {selectedImageUrl ? (
              // Show selected image with option to change
              <div className="h-full">
                <img 
                  src={selectedImageUrl} 
                  alt="Selected post image" 
                  className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setSelectedImageUrl(null)}
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Click image to change
                </p>
              </div>
            ) : contentTaskId ? (
              // Show MediaSelector when no image is selected
              <MediaSelector
                onImageSelect={(imageUrl, metadata) => {
                  setSelectedImageUrl(imageUrl);
                  updateImageMutation.mutate({ imageUrl, metadata });
                }}
                contentContext={content}
                compact={true}
                className="h-full"
              />
            ) : (
              <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                <p className="text-gray-500 text-sm">No image available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
