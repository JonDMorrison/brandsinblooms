
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, AlertTriangle } from 'lucide-react';

const UserDataDeletionPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-gray-900">Delete Your BloomSuite Data</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              You can request deletion of your BloomSuite account and all associated data. This process is permanent and cannot be undone.
            </p>
          </div>

          {/* What will be deleted */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                What Will Be Deleted
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                When you delete your BloomSuite account, the following data will be permanently removed:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Your company profile and business information</li>
                <li>All generated content, campaigns, and marketing materials</li>
                <li>Social media connections and scheduled posts</li>
                <li>Analytics data and performance metrics</li>
                <li>Account preferences and settings</li>
                <li>Billing history and subscription information</li>
                <li>All uploaded images and media files</li>
              </ul>
            </CardContent>
          </Card>

          {/* Self-service steps */}
          <Card>
            <CardHeader>
              <CardTitle>Self-Service Deletion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                If you have an active BloomSuite account, you can delete your data directly from your account settings:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 ml-4">
                <li>Log in to your BloomSuite account</li>
                <li>Navigate to Settings and then Account</li>
                <li>Scroll down to the Danger Zone section</li>
                <li>Click "Delete Account" and follow the confirmation steps</li>
                <li>You will receive an email confirmation of the deletion request</li>
              </ol>
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-blue-800 text-sm">
                  <strong>Grace Period:</strong> You have 30 days after requesting deletion to reactivate your account. 
                  After 30 days, all data will be permanently deleted and cannot be recovered.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Email fallback */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email Request
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                If you cannot access your account or prefer to request deletion via email, you can contact our support team:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium text-gray-900">Email: privacy@bloomsuite.com</p>
                <p className="text-sm text-gray-600 mt-2">
                  Please include the email address associated with your BloomSuite account and clearly state that you want to delete your account and all associated data.
                </p>
              </div>
              <p className="text-gray-700">
                We will verify your identity and process your deletion request within 5 business days.
              </p>
            </CardContent>
          </Card>

          {/* Irreversible notice */}
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800">Important Notice</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-red-700">
                <p className="font-medium">This action is irreversible after the 30-day grace period.</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>All your content and campaigns will be permanently lost</li>
                  <li>Your social media connections will be revoked</li>
                  <li>You will lose access to all analytics and historical data</li>
                  <li>Any active subscriptions will be cancelled</li>
                </ul>
                <p>
                  Please ensure you have exported any data you wish to keep before requesting deletion.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">
                If you have questions about data deletion or need assistance with your account, please contact us:
              </p>
              <div className="mt-4 space-y-2">
                <p><strong>Email:</strong> support@bloomsuite.com</p>
                <p><strong>Privacy Questions:</strong> privacy@bloomsuite.com</p>
              </div>
              <p className="text-sm text-gray-600 mt-4">
                We are committed to protecting your privacy and will handle your data deletion request in accordance with applicable privacy laws.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UserDataDeletionPage;
