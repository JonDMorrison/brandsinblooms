import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, Sparkles } from 'lucide-react';
import { UGCGallery } from '@/components/community/UGCGallery';
import { UGCUploadForm } from '@/components/community/UGCUploadForm';
import { StaffPrompts } from '@/components/community/StaffPrompts';
import { PromptsAdmin } from '@/components/community/PromptsAdmin';
import { useUser } from '@/hooks/useUser';

export const CommunityPage = () => {
  const [activeTab, setActiveTab] = useState('gallery');
  const { user } = useUser();
  
  // Check if user is admin (simplified - in production, check from user_roles table)
  const isAdmin = user?.email?.includes('admin') || user?.email?.includes('jeff') || user?.email?.includes('jon');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Camera className="w-8 h-8 text-primary" />
            Community Stories
          </h1>
          <p className="text-muted-foreground mt-1">
            Capture and share customer success stories
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="prompts">
            <Sparkles className="w-4 h-4 mr-2" />
            Today's Prompts
          </TabsTrigger>
          {isAdmin && <TabsTrigger value="admin">Admin</TabsTrigger>}
        </TabsList>

        <TabsContent value="gallery" className="space-y-6">
          <UGCGallery />
        </TabsContent>

        <TabsContent value="upload" className="space-y-6">
          <UGCUploadForm onSuccess={() => setActiveTab('gallery')} />
        </TabsContent>

        <TabsContent value="prompts" className="space-y-6">
          <StaffPrompts onUploadClick={() => setActiveTab('upload')} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="admin" className="space-y-6">
            <PromptsAdmin />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
