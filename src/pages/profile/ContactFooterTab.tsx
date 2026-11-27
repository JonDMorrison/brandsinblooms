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
import { useTenant } from '@/hooks/useTenant';
import {
  clearBusinessProfileUserIdCache,
  getBusinessProfileUserId,
  getTenantBusinessProfileUserId,
} from "@/lib/profile/businessProfileUserId";

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

const CONTACT_FIELDS = [
  'company_phone',
  'company_email',
  'website_url',
  'street_address',
  'city',
  'state_province',
  'postal_code',
  'country',
  'facebook_url',
  'instagram_url',
  'tiktok_url',
  'pinterest_url',
  'youtube_url',
  'linkedin_url',
  'footer_legal_text',
] as const satisfies readonly (keyof ContactFormData)[];

const EMPTY_FORM: ContactFormData = {
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
};

/**
 * Which business profile this page edits.
 * - `profileUserId`: the company_profiles.user_id to read (null when the
 *   active tenant has no profile yet or it could not be resolved).
 * - `rpcTenantId`: set when the profile belongs to another tenant than the
 *   signed-in user's own business (a master admin using the tenant switcher).
 *   RLS only allows writing your own business profile, so those saves go
 *   through public.save_tenant_contact_footer.
 */
interface ProfileTarget {
  profileUserId: string | null;
  rpcTenantId: string | null;
}

export const ContactFooterTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  // The page edits the active tenant's business profile (including the admin
  // tenant switcher), never the signed-in admin's own company.
  const { tenant, loading: tenantLoading } = useTenant();
  const tenantId = tenant?.id ?? null;
  const [target, setTarget] = useState<ProfileTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(EMPTY_FORM);
  const [originalData, setOriginalData] = useState<ContactFormData>(formData);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    if (tenantLoading) return;

    try {
      setIsLoading(true);
      setIsEditing(false);
      setProfileId(null);
      setFormData(EMPTY_FORM);
      setOriginalData(EMPTY_FORM);

      const ownProfileUserId = await getBusinessProfileUserId(user.id);
      const profileUserId = tenantId
        ? await getTenantBusinessProfileUserId(user.id, tenantId)
        : ownProfileUserId;
      const nextTarget: ProfileTarget = {
        profileUserId,
        rpcTenantId:
          tenantId && profileUserId !== ownProfileUserId ? tenantId : null,
      };
      setTarget(nextTarget);

      if (!profileUserId) return;

      const { data, error } = await supabase
        .from('company_profiles')
        .select('id, company_phone, company_email, website_url, street_address, city, state_province, postal_code, country, facebook_url, instagram_url, tiktok_url, pinterest_url, youtube_url, linkedin_url, footer_legal_text')
        .eq('user_id', profileUserId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        setProfileId(data.id);
        const loadedData: ContactFormData = { ...EMPTY_FORM };
        for (const field of CONTACT_FIELDS) {
          loadedData[field] = data[field] || '';
        }
        setFormData(loadedData);
        setOriginalData(loadedData);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, tenantId, tenantLoading]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleInputChange = (field: keyof ContactFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const saveViaTenantRpc = async (tenantIdToSave: string) => {
    // Send only the fields that changed, so a profile that failed to load
    // can never be blanked by saving an empty form.
    const changed: Partial<Record<keyof ContactFormData, string | null>> = {};
    for (const field of CONTACT_FIELDS) {
      if (formData[field] !== originalData[field]) {
        changed[field] = formData[field] || null;
      }
    }
    const { data, error } = await supabase.rpc('save_tenant_contact_footer', {
      p_tenant_id: tenantIdToSave,
      p_contact: changed,
    });
    return { data: data ? { id: data } : null, error };
  };

  const handleSave = async () => {
    if (!user?.id || !target) return;

    setIsSaving(true);
    try {
      let result: {
        data: { id: string } | null;
        error: { message: string } | null;
      };

      if (target.rpcTenantId) {
        result = await saveViaTenantRpc(target.rpcTenantId);
        if (!result.error && !profileId) {
          // The tenant had no profile; the RPC created one. Let other
          // surfaces re-resolve the tenant's profile owner.
          clearBusinessProfileUserIdCache();
        }
      } else {
        const payload = {
          user_id: target.profileUserId ?? (await getBusinessProfileUserId(user.id)),
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
          {target?.rpcTenantId && tenant?.name ? (
            <p className="text-sm text-muted-foreground mt-1" data-testid="contact-footer-tenant-scope">
              Editing the business profile for <span className="font-medium text-foreground">{tenant.name}</span>
            </p>
          ) : null}
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
