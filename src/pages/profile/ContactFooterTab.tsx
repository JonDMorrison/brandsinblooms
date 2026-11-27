import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-legacy/card';
import { Label } from '@/components/ui-legacy/label';
import { Input } from '@/components/ui-legacy/input';
import { Textarea } from '@/components/ui-legacy/textarea';
import { Button } from '@/components/ui-legacy/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
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
  Shield,
  Building2
} from 'lucide-react';
import {
  getTenantBusinessProfileUserId,
  notifyBusinessProfileChanged,
} from "@/lib/profile/businessProfileUserId";
import { realBusinessName } from "@/lib/studio/businessPlaceholders";

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

// Errors the save RPC raises on purpose carry a message written for the user.
const USER_FACING_SAVE_ERROR_CODES = new Set(['42501', 'P0002']);

export const ContactFooterTab = () => {
  const { user } = useAuth();
  // The page edits the active tenant's business profile: the same row the
  // campaign editor's address check and the email footer read
  // (getTenantBusinessProfileUserId), including a client's tenant that a
  // master admin is working in through the tenant switcher.
  const { tenant, loading: tenantLoading } = useTenant();
  const tenantId = tenant?.id ?? null;
  const tenantName =
    realBusinessName(tenant?.name) || realBusinessName(tenant?.fallback_from_name);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [formData, setFormData] = useState<ContactFormData>(EMPTY_FORM);
  const [originalData, setOriginalData] = useState<ContactFormData>(EMPTY_FORM);
  const loadRequestIdRef = useRef(0);
  const businessName = profileName || tenantName;

  const fetchProfile = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    const isCurrent = () => requestId === loadRequestIdRef.current;

    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setIsEditing(false);
      const profileUserId = await getTenantBusinessProfileUserId(user.id, tenantId);
      if (!isCurrent()) return;

      if (!profileUserId) {
        // This tenant has no business profile yet; saving creates it.
        setHasProfile(false);
        setProfileName('');
        setFormData(EMPTY_FORM);
        setOriginalData(EMPTY_FORM);
        return;
      }

      const { data, error } = await supabase
        .from('company_profiles')
        .select('id, company_name, company_phone, company_email, website_url, street_address, city, state_province, postal_code, country, facebook_url, instagram_url, tiktok_url, pinterest_url, youtube_url, linkedin_url, footer_legal_text')
        .eq('user_id', profileUserId)
        .maybeSingle();
      if (!isCurrent()) return;

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      const loadedData: ContactFormData = data
        ? {
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
          }
        : EMPTY_FORM;
      setHasProfile(Boolean(data));
      setProfileName(realBusinessName(data?.company_name));
      setFormData(loadedData);
      setOriginalData(loadedData);
    } finally {
      if (isCurrent()) {
        setIsLoading(false);
      }
    }
  }, [user?.id, tenantId]);

  useEffect(() => {
    // Wait for the active tenant: loading before it resolves would show a
    // master admin's own company while they work in a client's account.
    if (user?.id && tenantLoading) {
      setIsLoading(true);
      return;
    }
    void fetchProfile();
  }, [fetchProfile, tenantLoading, user?.id]);

  const handleInputChange = (field: keyof ContactFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user?.id || tenantLoading) return;

    setIsSaving(true);
    try {
      // The RPC resolves the row for the active tenant server-side and checks
      // that the caller may edit it; only these contact/footer columns change.
      const { data, error } = await supabase.rpc('save_tenant_contact_footer', {
        p_company_phone: formData.company_phone,
        p_company_email: formData.company_email,
        p_website_url: formData.website_url,
        p_street_address: formData.street_address,
        p_city: formData.city,
        p_state_province: formData.state_province,
        p_postal_code: formData.postal_code,
        p_country: formData.country,
        p_facebook_url: formData.facebook_url,
        p_instagram_url: formData.instagram_url,
        p_tiktok_url: formData.tiktok_url,
        p_pinterest_url: formData.pinterest_url,
        p_youtube_url: formData.youtube_url,
        p_linkedin_url: formData.linkedin_url,
        p_footer_legal_text: formData.footer_legal_text,
        ...(tenantId ? { p_tenant_id: tenantId } : {}),
      });

      const saved = Array.isArray(data) ? data[0] : undefined;
      if (error || !saved?.profile_user_id) {
        console.error('Error saving contact info:', error);
        toast({
          title: "Error saving",
          description:
            error?.code && USER_FACING_SAVE_ERROR_CODES.has(error.code)
              ? error.message
              : "Failed to save contact information. Please try again.",
          variant: "destructive"
        });
        return;
      }

      setHasProfile(true);
      setOriginalData(formData);
      setIsEditing(false);
      // Refresh every reader of this business profile (the campaign editor's
      // address check, footers, Studio), in this tab and others.
      notifyBusinessProfileChanged({
        tenantId,
        profileUserId: saved.profile_user_id,
      });
      toast({
        title: "Saved successfully",
        description: businessName
          ? `Contact and footer settings for ${businessName} have been updated.`
          : "Your contact and footer settings have been updated.",
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
          {businessName ? (
            <p
              className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground"
              data-testid="contact-footer-editing-business"
            >
              <Building2 className="w-4 h-4" aria-hidden />
              Editing {businessName}
            </p>
          ) : null}
          {!hasProfile ? (
            <p className="mt-1 text-sm text-muted-foreground" data-testid="contact-footer-no-profile">
              This business has no profile yet. Saving creates it.
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
