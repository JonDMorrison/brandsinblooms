import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-legacy/dialog";
import { Button } from "@/components/ui-legacy/button";
import { Textarea } from "@/components/ui-legacy/textarea";
import { Badge } from "@/components/ui-legacy/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-legacy/tabs";
import { Checkbox } from "@/components/ui-legacy/checkbox";
import { Switch } from "@/components/ui-legacy/switch";
import { Label } from "@/components/ui-legacy/label";
import {
  Facebook,
  Instagram,
  AlertCircle,
  Image,
  Hash,
  Eye,
  Sparkles,
  X,
  Images,
} from "lucide-react";
// Removed sonner import - using global toast replacement
import { supabase } from "@/integrations/supabase/client";
import { ContentOptimizer } from "./ContentOptimizer";
import { ImageSelectButton } from "@/components/image";
import { CarouselImageSelector } from "./CarouselImageSelector";

interface SmartPostComposerProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  platform: "facebook" | "instagram";
  onSuccess: () => void;
  onPostingStart: () => void;
}

const PLATFORM_LIMITS = {
  facebook: { text: 63206, hashtags: 30 },
  instagram: { text: 2200, hashtags: 30 },
};

export const SmartPostComposer: React.FC<SmartPostComposerProps> = ({
  isOpen,
  onClose,
  task,
  platform,
  onSuccess,
  onPostingStart,
}) => {
  const [content, setContent] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [activeTab, setActiveTab] = useState("compose");
  const [showImageSection, setShowImageSection] = useState(true);
  const [isCarousel, setIsCarousel] = useState(false);
  const [carouselImages, setCarouselImages] = useState<string[]>([]);

  const limits = PLATFORM_LIMITS[platform];
  const contentLength = content.length;
  const hashtagCount = hashtags
    .split(" ")
    .filter((tag) => tag.trim().startsWith("#")).length;

  useEffect(() => {
    if (task?.ai_output) {
      // Extract content and hashtags from AI output
      const cleanContent = task.ai_output.replace(/<[^>]*>/g, "").trim();
      const hashtagMatch = cleanContent.match(/#\w+/g);

      if (hashtagMatch) {
        const extractedHashtags = hashtagMatch.join(" ");
        const contentWithoutHashtags = cleanContent.replace(/#\w+/g, "").trim();
        setContent(contentWithoutHashtags);
        setHashtags(extractedHashtags);
      } else {
        setContent(cleanContent);
      }
    }
  }, [task]);

  const handlePost = async () => {
    setIsPosting(true);
    onPostingStart();

    try {
      // Get session first and validate thoroughly
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        toast.error(
          "Authentication session expired. Please refresh the page and try again.",
        );
        return;
      }

      const token = sessionData.session.access_token;
      if (!token) {
        toast.error(
          "No authentication token found. Please refresh the page and try again.",
        );
        return;
      }

      const fullContent = hashtags ? `${content}\n\n${hashtags}` : content;

      // Update the task with the edited content and ensure it's approved
      await supabase
        .from("content_tasks")
        .update({
          ai_output: fullContent,
          status: "approved", // Ensure task is approved for posting
        })
        .eq("id", task.id);

      // Prepare payload with carousel support
      const payload: any = {
        taskId: task.id,
        platforms: [platform],
      };

      // Add carousel data if enabled
      if (isCarousel && carouselImages.length >= 2) {
        payload.isCarousel = true;
        payload.mediaUrls = carouselImages;
      }

      // Call edge function with proper headers
      const functionResponse = await supabase.functions.invoke("publish-task", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: payload,
      });

      const { data: responseData, error } = functionResponse;

      if (error) {
        console.error("❌ Edge function returned error:", error);
        throw new Error(
          error.message || `Edge function error: ${JSON.stringify(error)}`,
        );
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
        throw new Error(
          responseData?.message || `Failed to post to ${platform}`,
        );
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
      const extractedHashtags = hashtagMatch.join(" ");
      const contentWithoutHashtags = optimizedContent
        .replace(/#\w+/g, "")
        .trim();
      setContent(contentWithoutHashtags);
      setHashtags(extractedHashtags);
    } else {
      setContent(optimizedContent);
    }
    setActiveTab("compose");
  };

  const PlatformIcon = platform === "facebook" ? Facebook : Instagram;
  const platformName = platform === "facebook" ? "Facebook" : "Instagram";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlatformIcon className="w-5 h-5" />
            Post to {platformName}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
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
                <span>
                  {contentLength}/{limits.text} characters
                </span>
                {contentLength > limits.text * 0.9 && (
                  <Badge variant="outline" className="text-orange-600">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Approaching limit
                  </Badge>
                )}
              </div>
            </div>

            {/* Enhanced Image Section */}
            <div className="space-y-4">
              {/* Carousel Mode Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Images className="w-4 h-4" />
                  {isCarousel ? "Carousel Images" : "Image"}
                </label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isCarousel}
                    onCheckedChange={setIsCarousel}
                    id="carousel-mode"
                  />
                  <Label
                    htmlFor="carousel-mode"
                    className="text-sm cursor-pointer"
                  >
                    Carousel Mode (2-10 images)
                  </Label>
                </div>
              </div>

              {/* Image Selector */}
              {isCarousel ? (
                <CarouselImageSelector
                  images={carouselImages}
                  onChange={setCarouselImages}
                  platform={platform}
                />
              ) : (
                <ImageSelectButton
                  onImageSelect={async (imageUrl, metadata) => {
                    // The component handles database updates internally
                  }}
                  contentContext={content || task?.ai_output}
                />
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
                <span>
                  {hashtagCount}/{limits.hashtags} hashtags
                </span>
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
                  {platform === "facebook" ? (
                    <p>
                      Facebook tips: Posts with images get 2.3x more engagement.
                      Keep it conversational and ask questions to encourage
                      comments.
                    </p>
                  ) : (
                    <p>
                      Instagram tips: Images are required for Instagram posts.
                      Use all 30 hashtags for maximum reach.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4">
              {/* Carousel Warnings */}
              {isCarousel &&
                carouselImages.length > 0 &&
                carouselImages.length < 2 && (
                  <Badge
                    variant="outline"
                    className="w-full justify-center py-2 text-amber-600 border-amber-200"
                  >
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Add at least 2 images for carousel mode
                  </Badge>
                )}
              {isCarousel && carouselImages.length > 10 && (
                <Badge
                  variant="destructive"
                  className="w-full justify-center py-2"
                >
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Carousel cannot exceed 10 images
                </Badge>
              )}
              {platform === "instagram" &&
                isCarousel &&
                carouselImages.length >= 2 && (
                  <Badge
                    variant="outline"
                    className="w-full justify-center py-2 text-blue-600 border-blue-200"
                  >
                    Instagram requires all carousel images to have the same
                    aspect ratio
                  </Badge>
                )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isPosting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePost}
                  disabled={
                    isPosting ||
                    contentLength === 0 ||
                    hashtagCount > limits.hashtags ||
                    (isCarousel &&
                      (carouselImages.length < 2 || carouselImages.length > 10))
                  }
                  className={
                    platform === "facebook"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  }
                >
                  {isPosting ? "Posting..." : `Post to ${platformName}`}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="optimize">
            <ContentOptimizer
              content={content + (hashtags ? `\n\n${hashtags}` : "")}
              platform={platform}
              onOptimize={handleOptimizeContent}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
