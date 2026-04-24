import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui-legacy/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { CheckCircle2, Mail, ArrowLeft } from 'lucide-react';
import { LandingPageHeader } from '@/components/landing/LandingPageHeader';

export const ForgotPasswordSentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <LandingPageHeader onLogin={() => {}} showUserMenu={false} />
      <div className="flex items-center justify-center pt-8 pb-16 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Check Your Email</h1>
            <p className="text-gray-600">We've sent you password reset instructions</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Email Sent Successfully</CardTitle>
              <CardDescription>
                We've sent an email with a link to reset your password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {email && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Mail className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <span className="text-sm text-blue-900 break-all">{email}</span>
                </div>
              )}

              <div className="space-y-3 text-sm text-gray-600">
                <p className="font-medium text-gray-900">What to do next:</p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Check your email inbox for a message from BloomSuite</li>
                  <li>Click the "Reset Password" link in the email</li>
                  <li>Enter your new password on the reset page</li>
                  <li>Sign in with your new password</li>
                </ol>
              </div>

              <div className="pt-2 space-y-2 text-sm text-gray-600">
                <p className="font-medium text-gray-900">Didn't receive the email?</p>
                <ul className="space-y-1 ml-2">
                  <li>• Check your spam or junk folder</li>
                  <li>• Make sure you entered the correct email address</li>
                  <li>• Wait a few minutes and check again</li>
                </ul>
              </div>

              <Button 
                onClick={() => navigate('/auth')} 
                className="w-full mt-4"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Button>
            </CardContent>
          </Card>
          
          <div className="text-center mt-6">
            <button
              onClick={() => navigate('/forgot-password')}
              className="text-sm text-gray-600 hover:underline"
            >
              Try a different email address
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
