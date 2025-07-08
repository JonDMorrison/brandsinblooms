
import React, { useState, useEffect } from 'react';
import { CompanyProfileForm } from './CompanyProfileForm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const CompanyProfilePage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('company_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
          toast.error('Failed to load company profile');
          return;
        }

        setProfile(data || null);
      } catch (error) {
        console.error('Error in fetchProfile:', error);
        toast.error('An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  const handleProfileUpdate = (updatedProfile) => {
    setProfile(updatedProfile);
    setIsEditing(false);
    toast.success('Profile updated successfully');
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Company Profile</h1>
          <p className="text-gray-600 mt-2">
            Manage your business information and preferences
          </p>
        </div>
        <CompanyProfileForm 
          profile={profile}
          isEditing={isEditing}
          onToggleEdit={handleToggleEdit}
          onProfileUpdate={handleProfileUpdate}
        />
      </div>
    </div>
  );
};
