/**
 * @deprecated This component is deprecated as of v2.0
 * Use AI Personalization Dialog (Sparkles button) for image generation instead.
 * All images are now AI-generated and stored in global_image_gallery.
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

interface LiveUnsplashPickerProps {
  task: any;
  campaignTheme?: string;
}

export const LiveUnsplashPicker = ({ task, campaignTheme }: LiveUnsplashPickerProps) => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">AI Image Generation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <div className="text-center text-muted-foreground">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
          <p className="text-sm font-medium mb-2">
            Use the <strong>Sparkles button</strong> (✨) on any content block to generate AI images.
          </p>
          <p className="text-xs">
            All images are automatically stored in the central gallery with searchable tags.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};