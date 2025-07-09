import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UniversalImageSelector } from '@/components/publish/EnhancedImageSelector';

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
        <UniversalImageSelector
          task={task}
          onImageChange={(imageUrl) => {
            console.log('Image selected in live picker:', imageUrl);
            // The component handles database updates internally
          }}
          contentContext={task?.ai_output || campaignTheme}
          showTabs={true}
          defaultTab="find"
        />
      </CardContent>
    </Card>
  );
};