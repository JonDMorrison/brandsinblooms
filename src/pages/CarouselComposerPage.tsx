import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProtectedPageWrapper } from '@/components/ProtectedPageWrapper';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CarouselImageSelector } from '@/components/social/CarouselImageSelector';
import { SocialPostPreviewModal } from '@/components/publish/preview/SocialPostPreviewModal';
import { ArrowLeft, Eye, Send, AlertCircle } from 'lucide-react';
import { validateCarouselPost } from '@/utils/validateCarouselPost';

const CarouselComposerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const platform = (searchParams.get('platform') || 'instagram') as 'instagram' | 'facebook';
  
  const [caption, setCaption] = useState('');
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const validation = validateCarouselPost(platform, {
    platform,
    accountId: 'preview',
    caption,
    mediaUrls: carouselImages,
    isCarousel: true
  });

  const platformLimits = {
    instagram: { caption: 2200, name: 'Instagram' },
    facebook: { caption: 63206, name: 'Facebook' }
  };

  const limits = platformLimits[platform];
  const captionLength = caption.length;

  const handlePublish = async () => {
    if (!validation.ok) {
      return;
    }

    setIsPublishing(true);
    try {
      // TODO: Implement actual publishing logic
      // This would call the publish-task edge function with carousel data
      console.log('Publishing carousel:', { platform, caption, carouselImages });
      
      // Simulate publishing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success(`Carousel published to ${limits.name}!`);
      navigate(-1);
    } catch (error) {
      console.error('Failed to publish carousel:', error);
      toast.error('Failed to publish carousel. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <ProtectedPageWrapper>
      <div className="container max-w-5xl mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                Create {limits.name} Carousel
              </h1>
              <p className="text-muted-foreground">
                Create a multi-image carousel post with 2-10 images
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              disabled={carouselImages.length < 2}
              className="gap-2"
            >
              <Eye className="w-4 h-4" />
              Preview
            </Button>
            <Button
              onClick={handlePublish}
              disabled={!validation.ok || isPublishing}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {isPublishing ? 'Publishing...' : 'Publish'}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Images */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Carousel Images</CardTitle>
                <CardDescription>
                  Add 2-10 images. Drag to reorder.
                  {platform === 'instagram' && ' All images must have the same aspect ratio.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CarouselImageSelector
                  images={carouselImages}
                  onChange={setCarouselImages}
                  platform={platform}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Caption & Validation */}
          <div className="space-y-4">
            {/* Caption */}
            <Card>
              <CardHeader>
                <CardTitle>Caption</CardTitle>
                <CardDescription>
                  Write your post caption
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder={`Write your ${limits.name} carousel caption...`}
                    className="min-h-32"
                    maxLength={limits.caption}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{captionLength.toLocaleString()}/{limits.caption.toLocaleString()} characters</span>
                    {captionLength > limits.caption * 0.9 && (
                      <Badge variant="outline" className="text-amber-600 border-amber-200">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Approaching limit
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Validation Feedback */}
            {(validation.errors.length > 0 || validation.warnings.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Validation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {validation.errors.map((error, idx) => (
                    <div key={`error-${idx}`} className="flex items-start gap-2 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  ))}
                  {validation.warnings.map((warning, idx) => (
                    <div key={`warning-${idx}`} className="flex items-start gap-2 text-sm text-amber-600">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Platform Tips */}
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="text-lg">💡</span>
                  {limits.name} Carousel Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                {platform === 'instagram' ? (
                  <>
                    <p>• All images must have the same aspect ratio (e.g., all 1:1 or all 4:5)</p>
                    <p>• Maximum 10 images per carousel</p>
                    <p>• Each image can be up to 8MB</p>
                    <p>• Tell a story across your images for better engagement</p>
                  </>
                ) : (
                  <>
                    <p>• Mixed aspect ratios are allowed</p>
                    <p>• Maximum 10 images per carousel</p>
                    <p>• Each image can be up to 4MB</p>
                    <p>• First image appears as thumbnail in feed</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && carouselImages.length >= 2 && (
        <SocialPostPreviewModal
          open={showPreview}
          onClose={() => setShowPreview(false)}
          platform={platform}
          onPlatformChange={(newPlatform) => {
            // Platform change not supported in carousel mode
            console.log('Platform change requested:', newPlatform);
          }}
          accountName="Your Account"
          caption={caption}
          mediaUrl={carouselImages[0]}
          mediaUrls={carouselImages}
          isCarousel={true}
        />
      )}
    </ProtectedPageWrapper>
  );
};

export default CarouselComposerPage;
