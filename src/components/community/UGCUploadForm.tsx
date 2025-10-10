import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Upload, Camera, Video, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/useUser';

interface UGCUploadFormProps {
  onSuccess?: () => void;
  promptId?: string;
}

export const UGCUploadForm = ({ onSuccess, promptId }: UGCUploadFormProps) => {
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    customerName: '',
    caption: '',
    tags: '',
    consent: false,
  });
  const { toast } = useToast();
  const { user } = useUser();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setVideoFile(file);
  };

  const uploadFile = async (file: File, type: 'image' | 'video') => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}-${Date.now()}.${fileExt}`;
    const filePath = `ugc/${type}s/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('content-assets')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('content-assets')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({ title: 'Error', description: 'You must be logged in', variant: 'destructive' });
      return;
    }

    if (!formData.consent) {
      toast({ title: 'Error', description: 'Customer consent is required', variant: 'destructive' });
      return;
    }

    if (!imageFile && !videoFile) {
      toast({ title: 'Error', description: 'Please upload an image or video', variant: 'destructive' });
      return;
    }

    setUploading(true);

    try {
      let imageUrl = null;
      let videoUrl = null;

      if (imageFile) imageUrl = await uploadFile(imageFile, 'image');
      if (videoFile) videoUrl = await uploadFile(videoFile, 'video');

      // Get user's tenant_id
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      const { error } = await supabase.from('ugc_submissions').insert({
        image_url: imageUrl,
        video_url: videoUrl,
        caption_text: formData.caption,
        customer_name: formData.customerName,
        customer_consent: formData.consent,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        submitted_by_staff_id: user.id,
        tenant_id: userData?.tenant_id,
        status: 'pending_review',
      });

      if (error) throw error;

      // If this was from a prompt, record the completion
      if (promptId) {
        await supabase.from('staff_prompt_responses').insert({
          prompt_id: promptId,
          staff_id: user.id,
          tenant_id: userData?.tenant_id,
        });
      }

      toast({
        title: 'Success! 🎉',
        description: 'Your submission has been uploaded for review',
      });

      // Reset form
      setFormData({ customerName: '', caption: '', tags: '', consent: false });
      setImageFile(null);
      setVideoFile(null);
      setImagePreview(null);
      
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label>Upload Photo</Label>
            <div className="mt-2 flex items-center gap-4">
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md cursor-pointer hover:bg-primary/90"
              >
                <Camera className="w-4 h-4" />
                Choose Photo
              </label>
              {imagePreview && (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded" />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Upload Video (Optional)</Label>
            <div className="mt-2">
              <Input
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                className="hidden"
                id="video-upload"
              />
              <label
                htmlFor="video-upload"
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-md cursor-pointer hover:bg-secondary/90 inline-flex"
              >
                <Video className="w-4 h-4" />
                {videoFile ? videoFile.name : 'Choose Video'}
              </label>
            </div>
          </div>

          <div>
            <Label htmlFor="customer-name">Customer Name</Label>
            <Input
              id="customer-name"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              placeholder="John Smith"
              required
            />
          </div>

          <div>
            <Label htmlFor="caption">Story / Caption</Label>
            <Textarea
              id="caption"
              value={formData.caption}
              onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
              placeholder="Share the customer's garden transformation story..."
              rows={4}
              required
            />
          </div>

          <div>
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="houseplants, patio makeover, spring garden"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="consent"
              checked={formData.consent}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, consent: checked as boolean })
              }
            />
            <Label htmlFor="consent" className="text-sm">
              Customer has given permission to share this content
            </Label>
          </div>
        </div>

        <Button type="submit" disabled={uploading} className="w-full">
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? 'Uploading...' : 'Submit Story'}
        </Button>
      </form>
    </Card>
  );
};
