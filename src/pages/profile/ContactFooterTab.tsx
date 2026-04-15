import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-legacy/card';
import { Label } from '@/components/ui-legacy/label';
import { Input } from '@/components/ui-legacy/input';
import { Textarea } from '@/components/ui-legacy/textarea';
import { Button } from '@/components/ui-legacy/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Globe, 
  Facebook, 
  Instagram, 
  Linkedin,
  FileText,
  Save,
  Edit,
  X,
  ExternalLink,
  Shield
} from 'lucide-react';

interface ContactFormData {
  company_phone: string;
  company_email: string;
  website_url: string;
  street_address: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  pinterest_url: string;
  youtube_url: string;
  linkedin_url: string;
  footer_legal_text: string;
}

export const ContactFooterTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ContactFormData>({
    company_phone: '',
    company_email: '',
    website_url: '',
    street_address: '',
    city: '',
    state_province: '',
    postal_code: '',
    country: '',
    facebook_url: '',
    instagram_url: '',
    tiktok_url: '',
    pinterest_url: '',
    youtube_url: '',
    linkedin_url: '',
    footer_legal_text: '',
  });
  const [originalData, setOriginalData] = useState<ContactFormData>(formData);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('company_profiles')
        .select('id, company_phone, company_email, website_url, street_address, city, state_province, postal_code, country, facebook_url, instagram_url, tiktok_url, pinterest_url, youtube_url, linkedin_url, footer_legal_text')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        setProfileId(data.id);
        const loadedData: ContactFormData = {
          company_phone: data.company_phone || '',
          company_email: data.company_email || '',
          website_url: data.website_url || '',
          street_address: data.street_address || '',
          city: data.city || '',
          state_province: data.state_province || '',
          postal_code: data.postal_code || '',
          country: data.country || '',
          facebook_url: data.facebook_url || '',
          instagram_url: data.instagram_url || '',
          tiktok_url: data.tiktok_url || '',
          pinterest_url: data.pinterest_url || '',
          youtube_url: data.youtube_url || '',
          linkedin_url: data.linkedin_url || '',
          footer_legal_text: data.footer_legal_text || '',
        };
        setFormData(loadedData);
        setOriginalData(loadedData);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleInputChange = (field: keyof ContactFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      const payload = {
        user_id: user.id,
        company_phone: formData.company_phone || null,
        company_email: formData.company_email || null,
        website_url: formData.website_url || null,
        street_address: formData.street_address || null,
        city: formData.city || null,
        state_province: formData.state_province || null,
        postal_code: formData.postal_code || null,
        country: formData.country || null,
        facebook_url: formData.facebook_url || null,
        instagram_url: formData.instagram_url || null,
        tiktok_url: formData.tiktok_url || null,
        pinterest_url: formData.pinterest_url || null,
        youtube_url: formData.youtube_url || null,
        linkedin_url: formData.linkedin_url || null,
        footer_legal_text: formData.footer_legal_text || null,
      };

      let result;
      if (profileId) {
        result = await supabase
          .from('company_profiles')
          .update(payload)
          .eq('id', profileId)
          .select('id')
          .maybeSingle();
      } else {
        result = await supabase
          .from('company_profiles')
          .insert(payload)
          .select('id')
          .maybeSingle();
      }

      if (result.error) {
        console.error('Error saving contact info:', result.error);
        toast({
          title: "Error saving",
          description: "Failed to save contact information. Please try again.",
          variant: "destructive"
        });
        return;
      }

      if (result.data?.id) {
        setProfileId(result.data.id);
      }

      setOriginalData(formData);
      setIsEditing(false);
      toast({
        title: "Saved successfully",
        description: "Your contact and footer settings have been updated.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(originalData);
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Contact & Footer Settings</h2>
          <p className="text-muted-foreground mt-1">
            Manage your contact information, address, and email footer content
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Contact Information
          </CardTitle>
          <CardDescription>
            Your phone, email, and website - shown in email footers and customer communications
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="company_phone">Phone Number</Label>
            <Input
              id="company_phone"
              placeholder="(555) 123-4567"
              value={formData.company_phone}
              onChange={(e) => handleInputChange('company_phone', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div>
            <Label htmlFor="company_email">Email Address</Label>
            <Input
              id="company_email"
              type="email"
              placeholder="hello@yourbusiness.com"
              value={formData.company_email}
              onChange={(e) => handleInputChange('company_email', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="website_url">Website URL</Label>
            <Input
              id="website_url"
              placeholder="https://yourbusiness.com"
              value={formData.website_url}
              onChange={(e) => handleInputChange('website_url', e.target.value)}
              disabled={!isEditing}
            />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Business Address
          </CardTitle>
          <CardDescription>
            Your physical address for email footer compliance (CAN-SPAM, GDPR)
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="street_address">Street Address</Label>
            <Input
              id="street_address"
              placeholder="123 Main Street, Suite 100"
              value={formData.street_address}
              onChange={(e) => handleInputChange('street_address', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="Your City"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div>
            <Label htmlFor="state_province">State / Province</Label>
            <Input
              id="state_province"
              placeholder="CA"
              value={formData.state_province}
              onChange={(e) => handleInputChange('state_province', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div>
            <Label htmlFor="postal_code">Postal Code</Label>
            <Input
              id="postal_code"
              placeholder="90210"
              value={formData.postal_code}
              onChange={(e) => handleInputChange('postal_code', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              placeholder="United States"
              value={formData.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
              disabled={!isEditing}
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Media */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Social Media Links
          </CardTitle>
          <CardDescription>
            Add your social profiles to include icons in email footers
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="facebook_url" className="flex items-center gap-2">
              <Facebook className="w-4 h-4" /> Facebook
            </Label>
            <Input
              id="facebook_url"
              placeholder="https://facebook.com/yourbusiness"
              value={formData.facebook_url}
              onChange={(e) => handleInputChange('facebook_url', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div>
            <Label htmlFor="instagram_url" className="flex items-center gap-2">
              <Instagram className="w-4 h-4" /> Instagram
            </Label>
            <Input
              id="instagram_url"
              placeholder="https://instagram.com/yourbusiness"
              value={formData.instagram_url}
              onChange={(e) => handleInputChange('instagram_url', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div>
            <Label htmlFor="tiktok_url">TikTok</Label>
            <Input
              id="tiktok_url"
              placeholder="https://tiktok.com/@yourbusiness"
              value={formData.tiktok_url}
              onChange={(e) => handleInputChange('tiktok_url', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div>
            <Label htmlFor="pinterest_url">Pinterest</Label>
            <Input
              id="pinterest_url"
              placeholder="https://pinterest.com/yourbusiness"
              value={formData.pinterest_url}
              onChange={(e) => handleInputChange('pinterest_url', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div>
            <Label htmlFor="youtube_url">YouTube</Label>
            <Input
              id="youtube_url"
              placeholder="https://youtube.com/@yourbusiness"
              value={formData.youtube_url}
              onChange={(e) => handleInputChange('youtube_url', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div>
            <Label htmlFor="linkedin_url" className="flex items-center gap-2">
              <Linkedin className="w-4 h-4" /> LinkedIn
            </Label>
            <Input
              id="linkedin_url"
              placeholder="https://linkedin.com/company/yourbusiness"
              value={formData.linkedin_url}
              onChange={(e) => handleInputChange('linkedin_url', e.target.value)}
              disabled={!isEditing}
            />
          </div>
        </CardContent>
      </Card>

      {/* Legal / Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Footer Legal Text
          </CardTitle>
          <CardDescription>
            Optional legal disclaimer or additional text for email footers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="footer_legal_text"
            placeholder="© 2024 Your Business. All rights reserved."
            value={formData.footer_legal_text}
            onChange={(e) => handleInputChange('footer_legal_text', e.target.value)}
            disabled={!isEditing}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Email Domain Setup Link */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <Link 
            to="/domains" 
            className="flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                  Email Domain & DNS Setup
                </p>
                <p className="text-sm text-muted-foreground">
                  Configure custom sending domain, SPF, DKIM, and DMARC records
                </p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};
