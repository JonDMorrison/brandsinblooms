
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';

export const DeleteAccountSection = () => {
  const { user, signOut } = useAuth();
  const { subscription } = useSubscription();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const hasActiveSubscription = subscription && subscription.plan !== 'free_trial' && 
    new Date(subscription.end_date) > new Date();

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    setIsLoading(true);

    try {
      // Call the delete account edge function
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { userId: user.id }
      });

      if (error) {
        console.error('Delete account error:', error);
        toast.error('Failed to delete account. Please try again or contact support.');
        return;
      }

      toast.success('Account scheduled for deletion - check your email for details');
      
      // Sign out the user
      await signOut();
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('An unexpected error occurred. Please contact support.');
    } finally {
      setIsLoading(false);
      setIsModalOpen(false);
      setConfirmText('');
    }
  };

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="text-red-800 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <h3 className="font-semibold text-red-800">Delete Account</h3>
          <p className="text-red-700 text-sm">
            Permanently delete your BloomSuite account and all associated data. This action cannot be undone after 30 days.
          </p>
          <ul className="text-red-600 text-sm space-y-1 ml-4 list-disc list-inside">
            <li>All your content and campaigns will be deleted</li>
            <li>Social media connections will be revoked</li>
            <li>Analytics data will be permanently lost</li>
            <li>Active subscriptions will be cancelled</li>
          </ul>
        </div>

        {hasActiveSubscription && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm font-medium">
              You have an active subscription. Please cancel your subscription first before deleting your account.
            </p>
          </div>
        )}

        <Button
          variant="destructive"
          onClick={() => setIsModalOpen(true)}
          disabled={hasActiveSubscription || isLoading}
          className="bg-red-600 hover:bg-red-700"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Account
        </Button>
      </CardContent>

      {/* Confirmation Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Delete Account Confirmation
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium mb-2">This action is irreversible after 30 days</p>
              <ul className="text-red-700 text-sm space-y-1 list-disc list-inside">
                <li>All your data will be permanently deleted</li>
                <li>You will lose access to all content and campaigns</li>
                <li>Social media connections will be revoked</li>
                <li>Analytics data cannot be recovered</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                To confirm deletion, type <strong>DELETE</strong> in the field below:
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsModalOpen(false);
                setConfirmText('');
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={confirmText !== 'DELETE' || isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? 'Deleting...' : 'Delete Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
