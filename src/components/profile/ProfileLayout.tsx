import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const ProfileLayout = () => {
  const location = useLocation();
  
  // Determine active tab from current path
  const getActiveTab = () => {
    if (location.pathname.includes('/brand-colors')) return 'brand-colors';
    return 'company';
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your business information and preferences
          </p>
        </div>

        {/* Tab Navigation */}
        <Tabs value={getActiveTab()} className="w-full">
          <TabsList className="w-full justify-start">
            <Link to="/profile/company">
              <TabsTrigger value="company">
                Company Information
              </TabsTrigger>
            </Link>
            <Link to="/profile/brand-colors">
              <TabsTrigger value="brand-colors">
                Brand Colors
              </TabsTrigger>
            </Link>
          </TabsList>
        </Tabs>

        {/* Tab Content */}
        <div className="mt-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
