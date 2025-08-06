import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CompanyProfileForm } from '@/components/CompanyProfileForm';
import { Building2 } from 'lucide-react';

export const BusinessProfileSettings = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Business Profile
          </CardTitle>
          <CardDescription>
            Manage your company information, brand voice, and target audience. This information is used to personalize your content generation and marketing campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyProfileForm 
            profile={null}
            isEditing={false}
            onToggleEdit={() => {}}
            onProfileUpdate={() => {}}
          />
        </CardContent>
      </Card>
    </div>
  );
};