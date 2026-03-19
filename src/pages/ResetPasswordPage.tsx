import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Lock, AlertCircle } from 'lucide-react';
import { LandingPageHeader } from '@/components/landing/LandingPageHeader';
import { getAuthErrorMessage } from '@/utils/errorHandling';

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    const checkToken = async () => {
      // PKCE flow: Supabase sends ?code=xxx in the URL
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        console.log('🔑 PKCE recovery code detected, exchanging for session...');
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('❌ Code exchange failed:', error.message);
            setIsValidToken(false);
            return;
          }
          if (data?.session) {
            console.log('✅ Recovery session established');
            // Clean the code from the URL so it can't be reused
            window.history.replaceState(null, '', '/reset-password');
            setIsValidToken(true);
            return;
          }
        } catch (err) {
          console.error('❌ Code exchange error:', err);
          setIsValidToken(false);
          return;
        }
      }

      // Fallback: check existing session (e.g. implicit flow or already exchanged)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsValidToken(true);
        return;
      }

      // Legacy implicit flow: check hash params
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      if (type === 'recovery') {
        setIsValidToken(true);
        return;
      }

      setIsValidToken(false);
    };
    
    checkToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        toast.error(getAuthErrorMessage(error));
      } else {
        toast.success('Password updated successfully!');
        
        // Sign out the user after password reset
        await supabase.auth.signOut();
        
        // Navigate to login with success message
        navigate('/auth', { 
          state: { message: 'Password reset successful. Please sign in with your new password.' }
        });
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (isValidToken === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isValidToken === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <LandingPageHeader onLogin={() => {}} showUserMenu={false} />
        <div className="flex items-center justify-center pt-8 pb-16 px-4">
          <div className="w-full max-w-md">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <AlertCircle className="h-5 w-5" />
                  <CardTitle>Invalid or Expired Link</CardTitle>
                </div>
                <CardDescription>
                  This password reset link is invalid or has expired.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Password reset links expire after a certain time for security reasons. 
                  Please request a new password reset link to continue.
                </p>
                <Button 
                  onClick={() => navigate('/forgot-password')} 
                  className="w-full"
                >
                  Request New Reset Link
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <LandingPageHeader onLogin={() => {}} showUserMenu={false} />
      <div className="flex items-center justify-center pt-8 pb-16 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Set New Password</h1>
            <p className="text-gray-600">Enter your new password below</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Create New Password</CardTitle>
              <CardDescription>
                Choose a strong password that you haven't used before
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter new password (min 6 characters)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      disabled={loading}
                      minLength={6}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      disabled={loading}
                      minLength={6}
                      required
                    />
                  </div>
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <p>Your password must:</p>
                  <ul className="list-disc list-inside ml-2">
                    <li>Be at least 6 characters long</li>
                    <li>Match the confirmation password</li>
                  </ul>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || !password || !confirmPassword}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating password...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
          
          <div className="text-center mt-6">
            <button
              onClick={() => navigate('/auth')}
              className="text-sm text-gray-600 hover:underline"
            >
              ← Back to login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
