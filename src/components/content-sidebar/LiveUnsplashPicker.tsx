import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageSelectButton } from '@/components/image';

interface LiveUnsplashPickerProps {
  task: any;
  campaignTheme?: string;
}

export const LiveUnsplashPicker = ({ task, campaignTheme }: LiveUnsplashPickerProps) => {

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Need an Image? We'll find you one.</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <ImageSelectButton
          onImageSelect={async (imageUrl, metadata) => {
            console.log('Image selected in live picker:', imageUrl);
            // The component handles database updates internally
          }}
          contentContext={task?.ai_output || campaignTheme}
        />
      </CardContent>
    </Card>
  );
};