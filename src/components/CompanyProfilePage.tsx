
import React from 'react';
import { CompanyProfileForm } from './CompanyProfileForm';

export const CompanyProfilePage = () => {
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
          profile={null}
          isEditing={false}
          onToggleEdit={() => {}}
          onProfileUpdate={() => {}}
        />
      </div>
    </div>
  );
};
