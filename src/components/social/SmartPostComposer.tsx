import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Facebook, Instagram, AlertCircle, Image, Hash, Eye, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ContentOptimizer } from './ContentOptimizer';
import { UnsplashPicker } from '@/components/images/UnsplashPicker';
import { extractImageKeyword } from '@/lib/api/unsplash';

interface SmartPostComposerProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  platform: 'facebook' | 'instagram';
  onSuccess: () => void;
  onPostingStart: () => void;
}

const PLATFORM_LIMITS = {
  facebook: { text: 63206, hashtags: 30 },
  instagram: { text: 2200, hashtags: 30 }
};

export const SmartPostComposer: React.FC<SmartPostComposerProps> = ({
  isOpen,
  onClose,
  task,
  platform,
  onSuccess,
  onPostingStart
}) => {
  const [content, setContent] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [activeTab, setActiveTab] = useState('compose');
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [autoImage, setAutoImage] = useState(true);
  const [imageKeyword, setImageKeyword] = useState('');

  const limits = PLATFORM_LIMITS[platform];
  const contentLength = content.length;
  const hashtagCount = hashtags.split(' ').filter(tag => tag.trim().startsWith('#')).length;

  useEffect(() => {
    if (task?.ai_output) {
      // Extract content and hashtags from AI output
      const cleanContent = task.ai_output.replace(/<[^>]*>/g, '').trim();
      const hashtagMatch = cleanContent.match(/#\w+/g);
      
      if (hashtagMatch) {
        const extractedHashtags = hashtagMatch.join(' ');
        const contentWithoutHashtags = cleanContent.replace(/#\w+/g, '').trim();
        setContent(contentWithoutHashtags);
        setHashtags(extractedHashtags);
      } else {
        setContent(cleanContent);
      }
    }

    // Load existing image attachment
    if (task?.attachments?.image) {
      setSelectedImage(task.attachments.image);
    }

    // Set initial image keyword based on content
    if (task?.ai_output) {
      const keyword = extractImageKeyword(task.ai_output);
      setImageKeyword(keyword);
    }
  }, [task]);

  const handlePost = async () => {
    setIsPosting(true);
    onPostingStart();

    try {
      // Get session first and validate thoroughly
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        toast.error('Authentication session expired. Please refresh the page and try again.');
        return;
      }

      const token = sessionData.session.access_token;
      if (!token) {
        toast.error('No authentication token found. Please refresh the page and try again.');
        return;
      }

      // Log first 15 characters of JWT for debugging
      console.log('🔑 JWT Token (first 15 chars):', token.substring(0, 15));
      console.log('🔐 Auth validation:', { 
        hasSession: !!sessionData.session,
        hasToken: !!token,
        tokenLength: token.length,
        userId: sessionData.session.user?.id
      });

      const fullContent = hashtags ? `${content}\n\n${hashtags}` : content;
      
      console.log('🔍 Posting debug info:', {
        taskId: task.id,
        taskStatus: task.status,
        platform,
        hasContent: !!fullContent,
        contentLength: fullContent.length,
        userId: sessionData.session.user.id
      });
      
      // Update the task with the edited content, image attachment, and ensure it's approved
      const attachments = selectedImage ? { image: selectedImage } : null;
      
      await supabase
        .from('content_tasks')
        .update({ 
          ai_output: fullContent,
          status: 'approved', // Ensure task is approved for posting
          attachments
        })
        .eq('id', task.id);
      
      console.log('📤 Calling publish-task edge function...');
      
      // Call edge function with proper headers
      const functionResponse = await supabase.functions.invoke('publish-task', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          taskId: task.id,
          platforms: [platform],
          keyword: imageKeyword || extractImageKeyword(fullContent),
          autoImage: autoImage && !selectedImage // Only auto-fetch if enabled and no manual image selected
        }
      });
        
      console.log('📥 Raw edge function response:', functionResponse);
      console.log('📥 Response data:', functionResponse.data);
      console.log('📥 Response error:', functionResponse.error);

      const { data: responseData, error } = functionResponse;

      if (error) {
        console.error('❌ Edge function returned error:', error);
        throw new Error(error.message || `Edge function error: ${JSON.stringify(error)}`);
      }

      if (responseData?.success) {
        const result = responseData.results?.[0];
        if (result?.success) {
          toast.success(`Successfully posted to ${platformName}!`);
          onSuccess();
          onClose();
        } else {
          throw new Error(result?.error || `Failed to post to ${platform}`);
        }
      } else {
        throw new Error(responseData?.message || `Failed to post to ${platform}`);
      }
    } catch (error: any) {
      console.error(`Error posting to ${platform}:`, error);
      toast.error(error.message || `Failed to post to ${platform}`);
    } finally {
      setIsPosting(false);
    }
  };

  const handleOptimizeContent = (optimizedContent: string) => {
    // Extract hashtags from optimized content
    const hashtagMatch = optimizedContent.match(/#\w+/g);
    if (hashtagMatch) {
      const extractedHashtags = hashtagMatch.join(' ');
      const contentWithoutHashtags = optimizedContent.replace(/#\w+/g, '').trim();
      setContent(contentWithoutHashtags);
      setHashtags(extractedHashtags);
    } else {
      setContent(optimizedContent);
    }
    setActiveTab('compose');
  };

  const handleImageSelect = (imageData: any) => {
    setSelectedImage(imageData);
    setShowImagePicker(false);
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
  };

  const PlatformIcon = platform === 'facebook' ? Facebook : Instagram;
  const platformName = platform === 'facebook' ? 'Facebook' : 'Instagram';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlatformIcon className="w-5 h-5" />
            Post to {platformName}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="compose" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Compose
            </TabsTrigger>
            <TabsTrigger value="optimize" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Optimize
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4">
            {/* Content Editor */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Post Content</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`Write your ${platformName} post...`}
                className="min-h-32"
                maxLength={limits.text}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{contentLength}/{limits.text} characters</span>
                {contentLength > limits.text * 0.9 && (
                  <Badge variant="outline" className="text-orange-600">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Approaching limit
                  </Badge>
                )}
              </div>
            </div>

            {/* Auto-Image Option */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto-image"
                  checked={autoImage}
                  onCheckedChange={(checked) => setAutoImage(checked === true)}
                />
                <label htmlFor="auto-image" className="text-sm font-medium">
                  Attach Unsplash image automatically
                </label>
              </div>
              
              {autoImage && !selectedImage && (
                <div className="space-y-2">
                  <label className="text-sm text-gray-600">Search keyword for image:</label>
                  <input
                    type="text"
                    value={imageKeyword}
                    onChange={(e) => setImageKeyword(e.target.value)}
                    placeholder="e.g., garden flowers, plant care"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    A royalty-free image from Unsplash will be automatically attached based on this keyword.
                  </p>
                </div>
              )}
            </div>

            {/* Manual Image Attachment */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Image className="w-4 h-4" />
                Manual Image Selection
              </label>
              
              {selectedImage ? (
                <div className="relative border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-start gap-3">
                    <img
                      src={selectedImage.thumb}
                      alt={selectedImage.alt}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedImage.alt}</p>
                      <p className="text-xs text-gray-500">by {selectedImage.author_name}</p>
                      <Badge variant="outline" className="mt-1 text-xs">
                        Unsplash
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeSelectedImage}
                      className="p-1 h-6 w-6"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowImagePicker(true)}
                  className="w-full h-20 border-dashed"
                  disabled={autoImage}
                >
                  <div className="text-center">
                    <Image className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {autoImage ? 'Disable auto-image to select manually' : 'Add Image from Unsplash'}
                    </span>
                  </div>
                </Button>
              )}
            </div>

            {/* Hashtags */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Hashtags
              </label>
              <Textarea
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#gardening #plants #flowers"
                className="min-h-20"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{hashtagCount}/{limits.hashtags} hashtags</span>
                {hashtagCount > limits.hashtags && (
                  <Badge variant="destructive">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Too many hashtags
                  </Badge>
                )}
              </div>
            </div>

            {/* Platform-specific hints */}
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <Eye className="w-4 h-4 mt-0.5 text-blue-600" />
                <div className="text-sm text-blue-700">
                  {platform === 'facebook' ? (
                    <p>Facebook tips: Posts with images get 2.3x more engagement. Keep it conversational and ask questions to encourage comments.</p>
                  ) : (
                    <p>Instagram tips: Images are required for Instagram posts. Use all 30 hashtags for maximum reach.</p>
                  )}
                  {autoImage && (
                    <p className="mt-1">
                      ✨ Auto-image is enabled - a relevant image will be automatically attached from Unsplash.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={onClose} disabled={isPosting}>
                Cancel
              </Button>
              <Button 
                onClick={handlePost} 
                disabled={isPosting || contentLength === 0 || hashtagCount > limits.hashtags || (platform === 'instagram' && !selectedImage && !autoImage)}
                className={platform === 'facebook' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'}
              >
                {isPosting ? 'Posting...' : `Post to ${platformName}`}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="optimize">
            <ContentOptimizer
              content={content + (hashtags ? `\n\n${hashtags}` : '')}
              platform={platform}
              onOptimize={handleOptimizeContent}
            />
          </TabsContent>
        </Tabs>

        {/* Unsplash Image Picker */}
        <UnsplashPicker
          isOpen={showImagePicker}
          onClose={() => setShowImagePicker(false)}
          onSelect={handleImageSelect}
          initialQuery={content.split(' ').slice(0, 3).join(' ')} // Use first few words as search hint
        />
      </DialogContent>
    </Dialog>
  );
};
