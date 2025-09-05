
import React, { useState, useEffect } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AccountPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    displayName: '',
    timezone: 'America/New_York'
  });

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

  const handleInputChange = (field: keyof typeof profileData, value: string) => {
    setProfileData(prev => ({
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">General</TabsTrigger>
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
