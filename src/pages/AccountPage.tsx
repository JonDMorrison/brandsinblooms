import React, { useState, useEffect, useCallback } from 'react';
import { ProtectedPageWrapper } from '@/components/ProtectedPageWrapper';
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import { BillingDashboard } from '@/components/billing/BillingDashboard';
import { UsageAnalytics } from '@/components/billing/UsageAnalytics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, Loader2 } from 'lucide-react';

const AccountPage = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);
  const [profileData, setProfileData] = useState({
    displayName: '',
    timezone: 'America/New_York'
  });
  const [businessData, setBusinessData] = useState({
    companyName: '',
    companyPhone: '',
    companyEmail: ''
  });
  const [isLoadingBusiness, setIsLoadingBusiness] = useState(true);

  // Load user profile data on component mount
  useEffect(() => {
    const loadProfileData = async () => {
      if (!user?.id) return;

      try {
        const { data: profile } = await supabase
          .from('company_profiles')
          .select('feature_flags, compliance_settings')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile) {
          const featureFlags = profile.feature_flags as any || {};
          const complianceSettings = profile.compliance_settings as any || {};
          
          setProfileData({
            displayName: featureFlags.display_name || user.user_metadata?.full_name || '',
            timezone: complianceSettings.timezone || 'America/New_York'
          });
        } else {
          // Set default values from user metadata if available
          setProfileData({
            displayName: user.user_metadata?.full_name || '',
            timezone: 'America/New_York'
          });
        }
      } catch (error) {
        console.error('Error loading profile data:', error);
        toast.error('Failed to load profile information');
      }
    };

    loadProfileData();
  }, [user]);

  // Load business profile data
  const loadBusinessData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingBusiness(true);

    try {
      const { data: profile } = await supabase
        .from('company_profiles')
        .select('company_name, company_phone, company_email')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile) {
        setBusinessData({
          companyName: profile.company_name || '',
          companyPhone: profile.company_phone || '',
          companyEmail: profile.company_email || ''
        });
      } else if (tenant?.name) {
        // Fallback to tenant name if no company profile exists
        setBusinessData(prev => ({
          ...prev,
          companyName: tenant.name
        }));
      }
    } catch (error) {
      console.error('Error loading business data:', error);
    } finally {
      setIsLoadingBusiness(false);
    }
  }, [user?.id, tenant?.name]);

  useEffect(() => {
    loadBusinessData();
  }, [loadBusinessData]);

  const handleInputChange = (field: keyof typeof profileData, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBusinessInputChange = (field: keyof typeof businessData, value: string) => {
    setBusinessData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      // First, try to get existing profile
      const { data: existingProfile } = await supabase
        .from('company_profiles')
        .select('feature_flags, compliance_settings')
        .eq('user_id', user.id)
        .maybeSingle();

      const currentFeatureFlags = (existingProfile?.feature_flags as any) || {};
      const currentComplianceSettings = (existingProfile?.compliance_settings as any) || {};

      const updatedFeatureFlags = {
        ...currentFeatureFlags,
        display_name: profileData.displayName
      };

      const updatedComplianceSettings = {
        ...currentComplianceSettings,
        timezone: profileData.timezone
      };

      if (existingProfile) {
        // Update existing profile
        const { error } = await supabase
          .from('company_profiles')
          .update({
            feature_flags: updatedFeatureFlags,
            compliance_settings: updatedComplianceSettings
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Create new profile
        const { error } = await supabase
          .from('company_profiles')
          .insert({
            user_id: user.id,
            feature_flags: updatedFeatureFlags,
            compliance_settings: updatedComplianceSettings
          });

        if (error) throw error;
      }

      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBusinessProfile = async () => {
    if (!user?.id) return;

    setIsSavingBusiness(true);
    try {
      // Upsert company_profiles
      const { data: existingProfile } = await supabase
        .from('company_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const profilePayload = {
        user_id: user.id,
        company_name: businessData.companyName || null,
        company_phone: businessData.companyPhone || null,
        company_email: businessData.companyEmail || null
      };

      if (existingProfile?.id) {
        const { error } = await supabase
          .from('company_profiles')
          .update(profilePayload)
          .eq('id', existingProfile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_profiles')
          .insert(profilePayload);
        if (error) throw error;
      }

      // Also update tenant name and fallback_from_name so emails use the correct name
      if (tenant?.id && businessData.companyName) {
        const { error: tenantError } = await supabase
          .from('tenants')
          .update({
            name: businessData.companyName,
            fallback_from_name: businessData.companyName
          })
          .eq('id', tenant.id);

        if (tenantError) {
          console.error('Error updating tenant name:', tenantError);
          // Don't fail the whole operation, just log it
        }
      }

      toast.success('Business profile updated! Your email campaigns will now use this name.');
    } catch (error) {
      console.error('Error saving business profile:', error);
      toast.error('Failed to save business profile');
    } finally {
      setIsSavingBusiness(false);
    }
  };

  return (
    <ProtectedPageWrapper>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
            <p className="text-muted-foreground">
              Manage your account preferences, billing, and subscription details
            </p>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="flex flex-wrap w-full gap-4 h-auto p-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="business">Business Profile</TabsTrigger>
              <TabsTrigger value="billing">Billing & Subscription</TabsTrigger>
              <TabsTrigger value="usage">Usage & Analytics</TabsTrigger>
              <TabsTrigger value="danger">Danger Zone</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>
                    Update your personal information and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={user?.email || ''} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Display Name</Label>
                      <Input 
                        id="name" 
                        type="text" 
                        placeholder="Enter your display name"
                        value={profileData.displayName}
                        onChange={(e) => handleInputChange('displayName', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <select 
                      id="timezone"
                      value={profileData.timezone}
                      onChange={(e) => handleInputChange('timezone', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="America/New_York">Eastern Time (EST/EDT)</option>
                      <option value="America/Chicago">Central Time (CST/CDT)</option>
                      <option value="America/Denver">Mountain Time (MST/MDT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PST/PDT)</option>
                      <option value="America/Anchorage">Alaska Time (AKST/AKDT)</option>
                      <option value="Pacific/Honolulu">Hawaii Time (HST)</option>
                      <option value="America/Vancouver">Pacific Time - Canada (PST/PDT)</option>
                      <option value="America/Toronto">Eastern Time - Canada (EST/EDT)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                  <Button 
                    onClick={handleSaveProfile} 
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Choose how you want to be notified about important updates
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Notification settings coming soon...
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="business" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Business Profile
                  </CardTitle>
                  <CardDescription>
                    This is the name that appears in your email campaigns. Update it here and it will be used for all future emails.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingBusiness ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="companyName">Business Name *</Label>
                        <Input 
                          id="companyName" 
                          type="text" 
                          placeholder="Enter your business name"
                          value={businessData.companyName}
                          onChange={(e) => handleBusinessInputChange('companyName', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          This is the "From" name recipients see in their inbox when you send email campaigns.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="companyPhone">Business Phone</Label>
                          <Input 
                            id="companyPhone" 
                            type="tel" 
                            placeholder="(555) 123-4567"
                            value={businessData.companyPhone}
                            onChange={(e) => handleBusinessInputChange('companyPhone', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="companyEmail">Business Email</Label>
                          <Input 
                            id="companyEmail" 
                            type="email" 
                            placeholder="hello@yourbusiness.com"
                            value={businessData.companyEmail}
                            onChange={(e) => handleBusinessInputChange('companyEmail', e.target.value)}
                          />
                        </div>
                      </div>
                      <Button 
                        onClick={handleSaveBusinessProfile} 
                        disabled={isSavingBusiness || !businessData.companyName.trim()}
                      >
                        {isSavingBusiness ? 'Saving...' : 'Save Business Profile'}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-6">
              <BillingDashboard />
            </TabsContent>

            <TabsContent value="usage" className="space-y-6">
              <UsageAnalytics />
            </TabsContent>

            <TabsContent value="danger" className="space-y-6">
              <DeleteAccountSection />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ProtectedPageWrapper>
  );
};

export default AccountPage;
